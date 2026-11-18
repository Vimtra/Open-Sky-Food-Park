-- Open Sky Food Park · contract version 1.5
-- Coupons: created in the admin panel, applied at checkout. The server works out every
-- discount itself; the client's number is only a preview.
--
--   coupons                     the codes and their rules
--   orders.coupon_id / coupon_code / discount_cents
--   stall_orders.discount_cents each stall's share of the discount (shares add up)
--   park_settings.coupons_enabled  master switch for the coupon box at checkout
--   quote_coupon(code, items)   preview for the cart
--   place_order(payload)        now takes payload.coupon_code

-- ============================================================ settings + table
alter table public.park_settings
  add column if not exists coupons_enabled boolean not null default true;

create type public.coupon_kind as enum ('percent', 'amount');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{2,23}$'),
  title text not null check (char_length(title) between 1 and 60),
  description text check (description is null or char_length(description) <= 200),
  kind public.coupon_kind not null,
  -- percent: 1..100 · amount: cents off
  value int not null check (value > 0),
  min_order_cents int not null default 0 check (min_order_cents >= 0),
  max_discount_cents int check (max_discount_cents is null or max_discount_cents > 0),
  -- null = every truck; otherwise only that truck's dishes count and get the discount
  stall_id text references public.stalls (id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  is_active boolean not null default true,
  -- listed under "Offers" at checkout; hidden codes work only when typed in
  show_in_app boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index coupons_stall_idx on public.coupons (stall_id);

alter table public.orders
  add column if not exists coupon_id uuid references public.coupons (id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists discount_cents int not null default 0 check (discount_cents >= 0);
create index if not exists orders_coupon_idx on public.orders (coupon_id);

alter table public.stall_orders
  add column if not exists discount_cents int not null default 0 check (discount_cents >= 0);

-- ============================================================ access
alter table public.coupons enable row level security;

create policy coupons_read on public.coupons for select using (
  public.is_admin()
  or (is_active and show_in_app and (ends_at is null or ends_at > now()))
);
create policy coupons_admin_insert on public.coupons for insert with check (public.is_admin());
create policy coupons_admin_update on public.coupons for update using (public.is_admin()) with check (public.is_admin());
create policy coupons_admin_delete on public.coupons for delete using (public.is_admin());

grant select on public.coupons to anon, authenticated;
grant insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;

-- ============================================================ the rules, in one place
-- Works out a coupon for a list of cart lines. Raises a coupon_* error when it does not apply.
-- p_uid may be null (a visitor not signed in yet): the per-customer limit is then checked at order time.
create or replace function public._coupon_quote(p_code text, p_uid uuid, p_items jsonb)
returns table (coupon_id uuid, code text, title text, stall_id text, discount_cents int)
language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons;
  v_settings public.park_settings;
  v_eligible int;
  v_used int;
  v_discount int;
begin
  select * into v_settings from public.park_settings where id = 1;
  if not coalesce(v_settings.coupons_enabled, false) then
    raise exception 'coupons_disabled';
  end if;

  select * into c from public.coupons where coupons.code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'coupon_not_found'; end if;
  if not c.is_active then raise exception 'coupon_inactive'; end if;
  if c.starts_at is not null and now() < c.starts_at then raise exception 'coupon_not_started'; end if;
  if c.ends_at is not null and now() >= c.ends_at then raise exception 'coupon_expired'; end if;

  select coalesce(sum(mi.price_cents * l.qty), 0) into v_eligible
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as l (menu_item_id text, qty int)
  join public.menu_items mi on mi.id = l.menu_item_id
  where l.qty between 1 and 50 and (c.stall_id is null or mi.stall_id = c.stall_id);

  if v_eligible = 0 then raise exception 'coupon_not_applicable'; end if;
  if v_eligible < c.min_order_cents then raise exception 'coupon_min_order'; end if;

  if c.usage_limit is not null then
    select count(*) into v_used from public.orders o where o.coupon_id = c.id and o.status <> 'cancelled';
    if v_used >= c.usage_limit then raise exception 'coupon_used_up'; end if;
  end if;
  if c.per_customer_limit is not null and p_uid is not null then
    select count(*) into v_used from public.orders o
    where o.coupon_id = c.id and o.customer_id = p_uid and o.status <> 'cancelled';
    if v_used >= c.per_customer_limit then raise exception 'coupon_already_used'; end if;
  end if;

  if c.kind = 'percent' then
    v_discount := round(v_eligible * c.value / 100.0)::int;
  else
    v_discount := c.value;
  end if;
  if c.max_discount_cents is not null then v_discount := least(v_discount, c.max_discount_cents); end if;
  v_discount := least(v_discount, v_eligible);

  return query select c.id, c.code, c.title, c.stall_id, v_discount;
end;
$$;

-- Cart preview. Returns { code, title, discount_cents } or raises a coupon_* error.
create or replace function public.quote_coupon(p_code text, p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q record;
begin
  select * into q from public._coupon_quote(p_code, auth.uid(), p_items);
  return jsonb_build_object('code', q.code, 'title', q.title, 'stall_id', q.stall_id, 'discount_cents', q.discount_cents);
end;
$$;

-- ============================================================ place_order, now with coupons
-- Same contract as 0001 plus payload.coupon_code (optional). The discount comes off the
-- item total before tax; each stall order carries its share of discount and tax.
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
  v_code text := nullif(upper(btrim(payload ->> 'coupon_code')), '');
  v_tip int := greatest(coalesce((payload ->> 'tip_cents')::int, 0), 0);
  v_items jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_lines int;
  v_stalls int;
  v_stall_no int := 0;
  v_found int;
  v_qty_ok boolean;
  v_available boolean;
  v_open boolean;
  v_item_total int;
  v_coupon record;
  v_coupon_id uuid;
  v_coupon_code text;
  v_coupon_stall text;
  v_discount int := 0;
  v_eligible_total int := 0;
  v_discount_left int := 0;
  v_stall_discount int;
  v_tax int;
  v_tax_left int;
  v_stall_tax int;
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

  if v_code is not null then
    -- one order at a time per coupon, so usage limits hold under load
    perform pg_advisory_xact_lock(hashtext('coupon:' || v_code));
    select * into v_coupon from public._coupon_quote(v_code, v_uid, v_items);
    v_coupon_id := v_coupon.coupon_id;
    v_coupon_code := v_coupon.code;
    v_coupon_stall := v_coupon.stall_id;
    v_discount := v_coupon.discount_cents;
    select coalesce(sum(mi.price_cents * l.qty), 0)::int into v_eligible_total
    from jsonb_to_recordset(v_items) as l (menu_item_id text, qty int)
    join public.menu_items mi on mi.id = l.menu_item_id
    where v_coupon_stall is null or mi.stall_id = v_coupon_stall;
  end if;
  v_discount_left := v_discount;

  v_tax := round((v_item_total - v_discount) * v_settings.tax_percent / 100.0)::int;
  v_tax_left := v_tax;
  v_total := v_item_total - v_discount + v_tax + v_settings.service_fee_cents + v_tip;

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
    item_total_cents, discount_cents, coupon_id, coupon_code, tax_cents, service_fee_cents, tip_cents, total_cents,
    payment_method, payment_status, status
  ) values (
    v_order_id, v_order_no, v_uid, v_name, v_phone, v_fulfilment, v_table, v_note,
    v_item_total, v_discount, v_coupon_id, v_coupon_code, v_tax, v_settings.service_fee_cents, v_tip, v_total,
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
    perform pg_advisory_xact_lock(hashtext('stall-token:' || v_stall.stall_id));

    select coalesce(max(token_no), 0) + 1 into v_token
    from public.stall_orders
    where stall_id = v_stall.stall_id
      and (created_at at time zone v_settings.timezone)::date = v_today;

    v_stall_no := v_stall_no + 1;

    -- this stall's share of the discount: in proportion to its eligible dishes; the last stall takes the remainder
    if v_discount = 0 or (v_coupon_stall is not null and v_coupon_stall <> v_stall.stall_id) then
      v_stall_discount := 0;
    elsif v_stall_no = v_stalls or v_coupon_stall is not null then
      v_stall_discount := v_discount_left;
    else
      v_stall_discount := least(round(v_discount * v_stall.subtotal / greatest(v_eligible_total, 1)::numeric)::int, v_discount_left);
    end if;
    v_discount_left := v_discount_left - v_stall_discount;

    -- tax on what this stall actually charges; the last stall takes the remainder so the shares add up
    if v_stall_no = v_stalls then
      v_stall_tax := v_tax_left;
    else
      v_stall_tax := least(round((v_stall.subtotal - v_stall_discount) * v_settings.tax_percent / 100.0)::int, v_tax_left);
    end if;
    v_tax_left := v_tax_left - v_stall_tax;

    insert into public.stall_orders (order_id, stall_id, token_no, status, subtotal_cents, discount_cents, tax_cents, placed_at)
    values (
      v_order_id, v_stall.stall_id, v_token,
      case when v_online then 'pending' else 'placed' end::public.ticket_status,
      v_stall.subtotal,
      v_stall_discount,
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

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total_cents', v_total, 'discount_cents', v_discount);
end;
$$;

revoke all on function public._coupon_quote(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.quote_coupon(text, jsonb) from public;
grant execute on function public.quote_coupon(text, jsonb) to anon, authenticated;
revoke all on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;
