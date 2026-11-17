-- Open Sky Food Park · contract version 1.2
-- Park contact details (shown on /contact and /help only when filled in) and
-- messages sent from the Contact us form, read and handled in the admin panel.

-- ============================================================ park contact details
alter table public.park_settings
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists hours_text text;

-- ============================================================ support messages
create type public.support_topic as enum ('order', 'feedback', 'lost_found', 'vendor', 'other');
create type public.support_status as enum ('new', 'in_progress', 'closed');

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  ref_no text not null unique,
  customer_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  contact text not null check (char_length(contact) between 3 and 120),
  topic public.support_topic not null,
  order_no text check (order_no is null or char_length(order_no) <= 20),
  message text not null check (char_length(message) between 5 and 2000),
  status public.support_status not null default 'new',
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index support_requests_status_idx on public.support_requests (status, created_at desc);

alter table public.support_requests enable row level security;

-- Only admins read and update messages. Everyone sends through submit_support_request().
create policy support_requests_admin_read on public.support_requests for select using (public.is_admin());
create policy support_requests_admin_update on public.support_requests for update using (public.is_admin()) with check (public.is_admin());

revoke all on public.support_requests from anon, authenticated;
grant select, update (status, handled_at) on public.support_requests to authenticated;
grant all on public.support_requests to service_role;

-- Sends a message to the park. Works signed in or not.
-- payload: { name, contact, topic, order_no, message }
-- returns: { id, ref_no }
-- errors: name_required, contact_required, message_too_short, message_too_long, too_many_messages
create or replace function public.submit_support_request(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(payload ->> 'name'), '');
  v_contact text := nullif(btrim(payload ->> 'contact'), '');
  v_message text := btrim(coalesce(payload ->> 'message', ''));
  v_order_no text := upper(nullif(btrim(payload ->> 'order_no'), ''));
  v_topic public.support_topic := coalesce(nullif(payload ->> 'topic', ''), 'other')::public.support_topic;
  v_ref text;
  v_id uuid;
begin
  if v_name is null then raise exception 'name_required'; end if;
  if v_contact is null or char_length(v_contact) < 3 then raise exception 'contact_required'; end if;
  if char_length(v_message) < 5 then raise exception 'message_too_short'; end if;
  if char_length(v_message) > 2000 then raise exception 'message_too_long'; end if;

  -- a light brake on floods: five messages per contact per hour
  if (
    select count(*) from public.support_requests
    where lower(contact) = lower(v_contact) and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'too_many_messages';
  end if;

  loop
    select 'HS-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
    into v_ref
    from generate_series(1, 5);
    exit when not exists (select 1 from public.support_requests where ref_no = v_ref);
  end loop;

  insert into public.support_requests (ref_no, customer_id, name, contact, topic, order_no, message)
  values (
    v_ref,
    (select id from public.profiles where id = auth.uid()),
    left(v_name, 80),
    left(v_contact, 120),
    v_topic,
    left(v_order_no, 20),
    v_message
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'ref_no', v_ref);
end;
$$;

revoke all on function public.submit_support_request(jsonb) from public;
grant execute on function public.submit_support_request(jsonb) to anon, authenticated;
