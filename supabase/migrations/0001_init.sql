-- Open Sky Food Park · shared database (Supabase / Postgres)
-- Contract version 1.1. Summary lives in COLLAB.md section 3; this file is the source of truth.
--
-- Run once in the Supabase SQL editor (or `supabase db push`), then run supabase/seed.sql.
-- Money is integer US cents. Catalog ids are readable text, orders use uuids.

-- ============================================================ types
create type public.user_role as enum ('customer', 'stall_staff', 'admin');
create type public.diet as enum ('veg', 'egg', 'nonveg');
create type public.fulfilment as enum ('pickup', 'table');
create type public.payment_method as enum ('online', 'pay_at_stall');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded');
create type public.order_status as enum ('awaiting_payment', 'active', 'completed', 'cancelled');
create type public.ticket_status as enum ('pending', 'placed', 'preparing', 'ready', 'completed', 'cancelled');

-- ============================================================ tables
create table public.park_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Open Sky Food Park',
  tagline text,
  address text,
  timezone text not null default 'America/Los_Angeles',
  instagram text,
  logo_url text,
  tax_percent numeric(6, 3) not null default 0 check (tax_percent >= 0 and tax_percent <= 30),
  service_fee_cents int not null default 0 check (service_fee_cents >= 0),
  ordering_enabled boolean not null default true,
  table_service_enabled boolean not null default true,
  announcement text,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.stalls (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  name text not null,
  tagline text,
  cuisines text[] not null default '{}',
  location_label text,
  phone text,
  instagram text,
  logo_url text,
  cover_url text,
  is_veg_only boolean not null default false,
  avg_prep_mins int check (avg_prep_mins is null or avg_prep_mins between 1 and 240),
  is_open boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.stall_staff (
  stall_id text not null references public.stalls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (stall_id, user_id)
);

create table public.cravings (
  slug text primary key,
  name text not null,
  image_url text,
  sort_order int not null default 0
);

create table public.menu_categories (
  id text primary key default gen_random_uuid()::text,
  stall_id text not null references public.stalls (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);
create index menu_categories_stall_idx on public.menu_categories (stall_id, sort_order);

create table public.menu_items (
  id text primary key default gen_random_uuid()::text,
  stall_id text not null references public.stalls (id) on delete cascade,
  category_id text not null references public.menu_categories (id) on delete cascade,
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  diet public.diet,
  image_url text,
  craving text references public.cravings (slug) on update cascade on delete set null,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index menu_items_stall_idx on public.menu_items (stall_id, category_id, sort_order);
create index menu_items_craving_idx on public.menu_items (craving);

create table public.banners (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subtitle text,
  image_url text,
  stall_id text references public.stalls (id) on delete cascade,
  menu_item_id text references public.menu_items (id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid not null references public.profiles (id),
  customer_name text not null,
  customer_phone text,
  fulfilment public.fulfilment not null,
  table_no text,
  note text,
  item_total_cents int not null check (item_total_cents >= 0),
  tax_cents int not null default 0 check (tax_cents >= 0),
  service_fee_cents int not null default 0 check (service_fee_cents >= 0),
  tip_cents int not null default 0 check (tip_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  payment_ref text,
  status public.order_status not null,
  created_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);

create table public.stall_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  stall_id text not null references public.stalls (id),
  token_no int not null,
  status public.ticket_status not null,
  subtotal_cents int not null check (subtotal_cents >= 0),
  -- this stall's share of orders.tax_cents; the shares always add up to the order's tax
  tax_cents int not null default 0 check (tax_cents >= 0),
  created_at timestamptz not null default now(),
  placed_at timestamptz,
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  unique (order_id, stall_id)
);
create index stall_orders_stall_idx on public.stall_orders (stall_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  stall_order_id uuid not null references public.stall_orders (id) on delete cascade,
  menu_item_id text references public.menu_items (id) on delete set null,
  name text not null,
  diet public.diet,
  unit_price_cents int not null check (unit_price_cents >= 0),
  qty int not null check (qty between 1 and 50),
  note text
);
create index order_items_stall_order_idx on public.order_items (stall_order_id);

-- ============================================================ access helpers
-- security definer so they can be used inside row policies without recursion.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff_of(p_stall_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.stall_staff where stall_id = p_stall_id and user_id = auth.uid()
  );
$$;

create or replace function public.owns_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = p_order_id and customer_id = auth.uid());
$$;

create or replace function public.staff_can_see_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.stall_orders so
    join public.stall_staff ss on ss.stall_id = so.stall_id
    where so.order_id = p_order_id and so.status <> 'pending' and ss.user_id = auth.uid()
  );
$$;

create or replace function public.can_see_stall_order(p_stall_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.stall_orders so
    join public.orders o on o.id = so.order_id
    where so.id = p_stall_order_id
      and (
        o.customer_id = auth.uid()
        or public.is_admin()
        or (so.status <> 'pending' and exists (
          select 1 from public.stall_staff ss where ss.stall_id = so.stall_id and ss.user_id = auth.uid()
        ))
      )
  );
$$;

-- ============================================================ profile lifecycle
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (new.id, new.phone, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only an admin (or the SQL editor / service key) may change a role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ============================================================ row level security
alter table public.park_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.stalls enable row level security;
alter table public.stall_staff enable row level security;
alter table public.cravings enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.banners enable row level security;
alter table public.orders enable row level security;
alter table public.stall_orders enable row level security;
alter table public.order_items enable row level security;

-- catalog: everyone reads, admins write
create policy park_settings_read on public.park_settings for select using (true);
create policy park_settings_admin on public.park_settings for update using (public.is_admin()) with check (public.is_admin());

create policy stalls_read on public.stalls for select using (is_active or public.is_staff_of(id));
create policy stalls_admin_insert on public.stalls for insert with check (public.is_admin());
create policy stalls_admin_update on public.stalls for update using (public.is_admin()) with check (public.is_admin());
create policy stalls_admin_delete on public.stalls for delete using (public.is_admin());

create policy cravings_read on public.cravings for select using (true);
create policy cravings_admin_insert on public.cravings for insert with check (public.is_admin());
create policy cravings_admin_update on public.cravings for update using (public.is_admin()) with check (public.is_admin());
create policy cravings_admin_delete on public.cravings for delete using (public.is_admin());

create policy menu_categories_read on public.menu_categories for select using (true);
create policy menu_categories_admin_insert on public.menu_categories for insert with check (public.is_admin());
create policy menu_categories_admin_update on public.menu_categories for update using (public.is_admin()) with check (public.is_admin());
create policy menu_categories_admin_delete on public.menu_categories for delete using (public.is_admin());

create policy menu_items_read on public.menu_items for select using (true);
create policy menu_items_admin_insert on public.menu_items for insert with check (public.is_admin());
create policy menu_items_admin_update on public.menu_items for update using (public.is_admin()) with check (public.is_admin());
create policy menu_items_admin_delete on public.menu_items for delete using (public.is_admin());

create policy banners_read on public.banners for select using (is_active or public.is_admin());
create policy banners_admin_insert on public.banners for insert with check (public.is_admin());
create policy banners_admin_update on public.banners for update using (public.is_admin()) with check (public.is_admin());
create policy banners_admin_delete on public.banners for delete using (public.is_admin());

-- people
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy stall_staff_read on public.stall_staff for select using (user_id = auth.uid() or public.is_admin());
create policy stall_staff_admin_insert on public.stall_staff for insert with check (public.is_admin());
create policy stall_staff_admin_delete on public.stall_staff for delete using (public.is_admin());

-- orders: read-only through policies; every write goes through the functions below
create policy orders_read on public.orders for select
  using (customer_id = auth.uid() or public.is_admin() or public.staff_can_see_order(id));

create policy stall_orders_read on public.stall_orders for select
  using (
    public.is_admin()
    or public.owns_order(order_id)
    or (status <> 'pending' and public.is_staff_of(stall_id))
  );

create policy order_items_read on public.order_items for select
  using (public.can_see_stall_order(stall_order_id));

-- ============================================================ grants
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon, authenticated;

grant select on public.park_settings, public.stalls, public.cravings, public.menu_categories,
  public.menu_items, public.banners to anon, authenticated;
grant select, update (full_name, phone, role) on public.profiles to authenticated;
grant select on public.stall_staff, public.orders, public.stall_orders, public.order_items to authenticated;
grant insert, update, delete on public.stalls, public.cravings, public.menu_categories,
  public.menu_items, public.banners to authenticated;
grant update on public.park_settings to authenticated;
grant insert, delete on public.stall_staff to authenticated;
grant all on all tables in schema public to service_role;

-- ============================================================ order functions

-- Recomputes the parent order's status after a stall order changes.
create or replace function public._sync_order_status(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_open int;
  v_completed int;
begin
  select
    count(*) filter (where status not in ('completed', 'cancelled')),
    count(*) filter (where status = 'completed')
  into v_open, v_completed
  from public.stall_orders
  where order_id = p_order_id;

  if v_open = 0 then
    update public.orders
    set status = case when v_completed > 0 then 'completed' else 'cancelled' end::public.order_status
    where id = p_order_id;
  end if;
end;
$$;

-- Places an order. The server reads prices and availability itself; the client's
-- numbers are never trusted.
-- payload: { fulfilment, table_no, customer_name, customer_phone, note, payment_method,
--            tip_cents, items: [{ menu_item_id, qty, note }] }
-- returns: { order_id, order_no, total_cents }
-- errors (message text): sign_in_required, ordering_closed, name_required, table_required,
--   table_service_unavailable, cart_empty, item_not_found, bad_quantity, item_unavailable,
--   stall_closed
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_settings public.park_settings;
  v_fulfilment public.fulfilment;
  v_method public.payment_method;
  v_name text := nullif(btrim(payload ->> 'customer_name'), '');
  v_phone text := nullif(btrim(payload ->> 'customer_phone'), '');
  v_table text := nullif(btrim(payload ->> 'table_no'), '');
  v_note text := nullif(btrim(payload ->> 'note'), '');
  v_tip int := greatest(coalesce((payload ->> 'tip_cents')::int, 0), 0);
  v_items jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_lines int;
  v_stalls int;
  v_stall_no int := 0;
  v_stall_tax int;
  v_tax_left int;
  v_found int;
  v_qty_ok boolean;
  v_available boolean;
  v_open boolean;
  v_item_total int;
  v_tax int;
  v_total int;
  v_order_id uuid := gen_random_uuid();
  v_order_no text;
  v_today date;
  v_stall record;
  v_stall_order_id uuid;
  v_token int;
  v_online boolean;
begin
  if v_uid is null then
    raise exception 'sign_in_required' using errcode = '28000';
  end if;

  select * into v_settings from public.park_settings where id = 1;
  if not found or not v_settings.ordering_enabled then
    raise exception 'ordering_closed';
  end if;

  v_fulfilment := (payload ->> 'fulfilment')::public.fulfilment;
  v_method := (payload ->> 'payment_method')::public.payment_method;
  v_online := v_method = 'online';

  if v_name is null then
    raise exception 'name_required';
  end if;
  if v_fulfilment = 'table' then
    if not v_settings.table_service_enabled then
      raise exception 'table_service_unavailable';
    end if;
    if v_table is null then
      raise exception 'table_required';
    end if;
  else
    v_table := null;
  end if;

  select
    count(*),
    count(distinct mi.stall_id),
    count(mi.id),
    coalesce(bool_and(l.qty between 1 and 50), false),
    coalesce(bool_and(mi.is_available), false),
    coalesce(bool_and(s.is_open and s.is_active), false),
    coalesce(sum(mi.price_cents * l.qty), 0)
  into v_lines, v_stalls, v_found, v_qty_ok, v_available, v_open, v_item_total
  from jsonb_to_recordset(v_items) as l (menu_item_id text, qty int, note text)
  left join public.menu_items mi on mi.id = l.menu_item_id
  left join public.stalls s on s.id = mi.stall_id;

  if v_lines = 0 then raise exception 'cart_empty'; end if;
  if v_found <> v_lines then raise exception 'item_not_found'; end if;
  if not v_qty_ok then raise exception 'bad_quantity'; end if;
  if not v_available then raise exception 'item_unavailable'; end if;
  if not v_open then raise exception 'stall_closed'; end if;

  v_tax := round(v_item_total * v_settings.tax_percent / 100.0)::int;
  v_tax_left := v_tax;
  v_total := v_item_total + v_tax + v_settings.service_fee_cents + v_tip;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  update public.profiles
  set full_name = coalesce(full_name, v_name), phone = coalesce(phone, v_phone)
  where id = v_uid;

  loop
    select 'OS-' || string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
    into v_order_no
    from generate_series(1, 5);
    exit when not exists (select 1 from public.orders where order_no = v_order_no);
  end loop;

  insert into public.orders (
    id, order_no, customer_id, customer_name, customer_phone, fulfilment, table_no, note,
    item_total_cents, tax_cents, service_fee_cents, tip_cents, total_cents,
    payment_method, payment_status, status
  ) values (
    v_order_id, v_order_no, v_uid, v_name, v_phone, v_fulfilment, v_table, v_note,
    v_item_total, v_tax, v_settings.service_fee_cents, v_tip, v_total,
    v_method, 'unpaid', case when v_online then 'awaiting_payment' else 'active' end::public.order_status
  );

  v_today := (now() at time zone v_settings.timezone)::date;

  for v_stall in
    select mi.stall_id, sum(mi.price_cents * l.qty)::int as subtotal
    from jsonb_to_recordset(v_items) as l (menu_item_id text, qty int, note text)
    join public.menu_items mi on mi.id = l.menu_item_id
    group by mi.stall_id
    order by mi.stall_id
  loop
    -- one token counter per stall per day; the lock keeps two checkouts from sharing a number
    perform pg_advisory_xact_lock(hashtext('stall-token:' || v_stall.stall_id));

    select coalesce(max(token_no), 0) + 1 into v_token
    from public.stall_orders
    where stall_id = v_stall.stall_id
      and (created_at at time zone v_settings.timezone)::date = v_today;

    -- split the order's tax across stalls; the last stall takes the remainder so the shares add up exactly
    v_stall_no := v_stall_no + 1;
    if v_stall_no = v_stalls then
      v_stall_tax := v_tax_left;
    else
      v_stall_tax := least(round(v_stall.subtotal * v_settings.tax_percent / 100.0)::int, v_tax_left);
    end if;
    v_tax_left := v_tax_left - v_stall_tax;

    insert into public.stall_orders (order_id, stall_id, token_no, status, subtotal_cents, tax_cents, placed_at)
    values (
      v_order_id, v_stall.stall_id, v_token,
      case when v_online then 'pending' else 'placed' end::public.ticket_status,
      v_stall.subtotal,
      v_stall_tax,
      case when v_online then null else now() end
    )
    returning id into v_stall_order_id;

    insert into public.order_items (stall_order_id, menu_item_id, name, diet, unit_price_cents, qty, note)
    select v_stall_order_id, mi.id, mi.name, mi.diet, mi.price_cents, l.qty, nullif(btrim(l.note), '')
    from jsonb_to_recordset(v_items) as l (menu_item_id text, qty int, note text)
    join public.menu_items mi on mi.id = l.menu_item_id
    where mi.stall_id = v_stall.stall_id;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total_cents', v_total);
end;
$$;

-- Customer cancels while no stall has started cooking.
create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.orders
    where id = p_order_id and (customer_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'not_found';
  end if;

  if exists (
    select 1 from public.stall_orders
    where order_id = p_order_id and status not in ('pending', 'placed', 'cancelled')
  ) then
    raise exception 'already_in_progress';
  end if;

  update public.stall_orders
  set status = 'cancelled', completed_at = now()
  where order_id = p_order_id and status in ('pending', 'placed');

  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

-- Stall staff (or admin) moves a stall order forward.
-- placed -> preparing | cancelled, preparing -> ready | cancelled, ready -> completed
create or replace function public.set_stall_order_status(p_stall_order_id uuid, p_status public.ticket_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_so public.stall_orders;
begin
  select * into v_so from public.stall_orders where id = p_stall_order_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.is_staff_of(v_so.stall_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (
    (v_so.status = 'placed' and p_status in ('preparing', 'cancelled'))
    or (v_so.status = 'preparing' and p_status in ('ready', 'cancelled'))
    or (v_so.status = 'ready' and p_status = 'completed')
  ) then
    raise exception 'invalid_transition';
  end if;

  update public.stall_orders
  set status = p_status,
      accepted_at = case when p_status = 'preparing' then now() else accepted_at end,
      ready_at = case when p_status = 'ready' then now() else ready_at end,
      completed_at = case when p_status in ('completed', 'cancelled') then now() else completed_at end
  where id = p_stall_order_id;

  perform public._sync_order_status(v_so.order_id);
end;
$$;

-- Called only by the payment server (service key) after Stripe confirms.
create or replace function public.mark_order_paid(p_order_id uuid, p_payment_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders
  set payment_status = 'paid',
      payment_ref = p_payment_ref,
      status = case when status = 'awaiting_payment' then 'active' else status end
  where id = p_order_id and payment_status <> 'paid';

  update public.stall_orders
  set status = 'placed', placed_at = now()
  where order_id = p_order_id and status = 'pending';
end;
$$;

create or replace function public.set_item_available(p_item_id text, p_available boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_stall_id text;
begin
  select stall_id into v_stall_id from public.menu_items where id = p_item_id;
  if v_stall_id is null then
    raise exception 'not_found';
  end if;
  if not public.is_staff_of(v_stall_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.menu_items set is_available = p_available where id = p_item_id;
end;
$$;

create or replace function public.set_stall_open(p_stall_id text, p_open boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_of(p_stall_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.stalls set is_open = p_open where id = p_stall_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- function permissions: nothing is callable unless granted here
revoke all on function public._sync_order_status(uuid) from public, anon, authenticated;
revoke all on function public.mark_order_paid(uuid, text) from public, anon, authenticated;
revoke all on function public.place_order(jsonb) from public, anon;
revoke all on function public.cancel_order(uuid) from public, anon;
revoke all on function public.set_stall_order_status(uuid, public.ticket_status) from public, anon;
revoke all on function public.set_item_available(text, boolean) from public, anon;
revoke all on function public.set_stall_open(text, boolean) from public, anon;

grant execute on function public.place_order(jsonb) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.set_stall_order_status(uuid, public.ticket_status) to authenticated;
grant execute on function public.set_item_available(text, boolean) to authenticated;
grant execute on function public.set_stall_open(text, boolean) to authenticated;
grant execute on function public.mark_order_paid(uuid, text) to service_role;
grant execute on function public.is_admin(), public.is_staff_of(text), public.owns_order(uuid),
  public.staff_can_see_order(uuid), public.can_see_stall_order(uuid) to anon, authenticated;

-- ============================================================ realtime + storage
alter publication supabase_realtime add table public.orders, public.stall_orders, public.menu_items, public.stalls;

insert into storage.buckets (id, name, public)
values ('catalog', 'catalog', true)
on conflict (id) do nothing;

create policy catalog_images_read on storage.objects for select using (bucket_id = 'catalog');
create policy catalog_images_insert on storage.objects for insert with check (bucket_id = 'catalog' and public.is_admin());
create policy catalog_images_update on storage.objects for update using (bucket_id = 'catalog' and public.is_admin());
create policy catalog_images_delete on storage.objects for delete using (bucket_id = 'catalog' and public.is_admin());
