-- Open Sky Food Park · contract version 1.6
-- Built from the Swiggy gap analysis (ROADMAP.md). Run after 0005.
--
--   menu_option_groups / menu_options   dish options: size, spice, add-ons, each with an extra price
--   order_items.options                 snapshot of the options chosen ([{group, name, price_cents}])
--   favorites                           a customer's saved dishes and trucks
--   stall_hours, stalls.auto_hours,     opening hours per truck; pause orders for N minutes
--   stalls.paused_until
--   stall_orders.prep_mins / ready_by   prep time the truck sets when it accepts
--   orders.pickup_at                    order for later (park setting scheduled_orders_enabled)
--   order_ratings                       stars + comment per truck after pickup (staff-only unless ratings_public)
--   refunds, *.refunded_cents           refund queue; a paid order a truck rejects queues one by itself
--   device_tokens                       phones to notify when food is ready
--   report_sales / report_items / report_hours   numbers for the admin panel and each truck
--   stall_status / stall_wait_times     open now, paused, typical wait (from real orders only)

-- ============================================================ settings
alter table public.park_settings
  add column if not exists scheduled_orders_enabled boolean not null default false,
  add column if not exists ratings_public boolean not null default false;

-- ============================================================ dish options
create table public.menu_option_groups (
  id text primary key default gen_random_uuid()::text,
  menu_item_id text not null references public.menu_items (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  -- 1/1 = pick exactly one (a size); 0/3 = up to three add-ons
  min_select int not null default 0 check (min_select between 0 and 10),
  max_select int not null default 1 check (max_select between 1 and 20),
  sort_order int not null default 0,
  check (max_select >= min_select)
);
create index menu_option_groups_item_idx on public.menu_option_groups (menu_item_id, sort_order);

create table public.menu_options (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references public.menu_option_groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  -- added to the dish price; 0 for a free choice such as "Medium spicy"
  price_cents int not null default 0 check (price_cents between 0 and 100000),
  is_default boolean not null default false,
  is_available boolean not null default true,
  sort_order int not null default 0
);
create index menu_options_group_idx on public.menu_options (group_id, sort_order);

alter table public.order_items
  add column if not exists options jsonb not null default '[]'::jsonb;

-- ============================================================ favourites
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  menu_item_id text references public.menu_items (id) on delete cascade,
  stall_id text references public.stalls (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(menu_item_id, stall_id) = 1)
);
create unique index favorites_item_uq on public.favorites (user_id, menu_item_id) where menu_item_id is not null;
create unique index favorites_stall_uq on public.favorites (user_id, stall_id) where stall_id is not null;

-- ============================================================ hours, pause, prep time
alter table public.stalls
  add column if not exists auto_hours boolean not null default false,
  add column if not exists paused_until timestamptz;

create table public.stall_hours (
  id uuid primary key default gen_random_uuid(),
  stall_id text not null references public.stalls (id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday, in the park's time zone
  weekday int not null check (weekday between 0 and 6),
  opens time not null,
  -- closes before opens means past midnight (17:00 → 01:00)
  closes time not null,
  check (opens <> closes)
);
create index stall_hours_stall_idx on public.stall_hours (stall_id, weekday);

alter table public.stall_orders
  add column if not exists prep_mins int check (prep_mins is null or prep_mins between 1 and 120),
  add column if not exists ready_by timestamptz,
  add column if not exists refunded_cents int not null default 0 check (refunded_cents >= 0);

alter table public.orders
  add column if not exists pickup_at timestamptz,
  add column if not exists refunded_cents int not null default 0 check (refunded_cents >= 0);

-- ============================================================ ratings
create table public.order_ratings (
  id uuid primary key default gen_random_uuid(),
  stall_order_id uuid not null unique references public.stall_orders (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  stall_id text not null references public.stalls (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_ratings_stall_idx on public.order_ratings (stall_id, created_at desc);

-- ============================================================ refunds
create type public.refund_status as enum ('pending', 'succeeded', 'failed');

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- null = for the whole order (or its service fee and tip)
  stall_order_id uuid references public.stall_orders (id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  reason text not null check (char_length(reason) between 1 and 200),
  status public.refund_status not null default 'pending',
  stripe_refund_id text,
  error text,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_pending_idx on public.refunds (created_at) where status = 'pending';

-- ============================================================ phones to notify
create table public.device_tokens (
  token text primary key check (char_length(token) between 10 and 4096),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);

-- ============================================================ access
alter table public.menu_option_groups enable row level security;
alter table public.menu_options enable row level security;
alter table public.favorites enable row level security;
alter table public.stall_hours enable row level security;
alter table public.order_ratings enable row level security;
alter table public.refunds enable row level security;
alter table public.device_tokens enable row level security;

-- the stall a dish option belongs to, for staff checks
create or replace function public._option_group_stall(p_group_id text)
returns text language sql stable security definer set search_path = public as $$
  select mi.stall_id from public.menu_option_groups g join public.menu_items mi on mi.id = g.menu_item_id where g.id = p_group_id;
$$;
create or replace function public._menu_item_stall(p_item_id text)
returns text language sql stable security definer set search_path = public as $$
  select stall_id from public.menu_items where id = p_item_id;
$$;

-- Options: everyone reads; admin and that truck's staff write (S4: a truck edits its own menu).
create policy menu_option_groups_read on public.menu_option_groups for select using (true);
create policy menu_option_groups_write on public.menu_option_groups for all
  using (public.is_staff_of(public._menu_item_stall(menu_item_id)))
  with check (public.is_staff_of(public._menu_item_stall(menu_item_id)));
create policy menu_options_read on public.menu_options for select using (true);
create policy menu_options_write on public.menu_options for all
  using (public.is_staff_of(public._option_group_stall(group_id)))
  with check (public.is_staff_of(public._option_group_stall(group_id)));

-- A truck may edit its own dishes (price, photo, description, availability); admin keeps add/delete.
create policy menu_items_staff_update on public.menu_items for update
  using (public.is_staff_of(stall_id)) with check (public.is_staff_of(stall_id));

create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy stall_hours_read on public.stall_hours for select using (true);

create policy order_ratings_read on public.order_ratings for select
  using (customer_id = auth.uid() or public.is_staff_of(stall_id));

create policy refunds_read on public.refunds for select
  using (public.is_admin() or public.owns_order(order_id));

create policy device_tokens_own on public.device_tokens for select using (user_id = auth.uid());

grant select on public.menu_option_groups, public.menu_options, public.stall_hours to anon, authenticated;
grant insert, update, delete on public.menu_option_groups, public.menu_options to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select on public.order_ratings, public.refunds, public.device_tokens to authenticated;
grant all on public.menu_option_groups, public.menu_options, public.favorites, public.stall_hours,
  public.order_ratings, public.refunds, public.device_tokens to service_role;

-- Stall staff may upload dish photos (S4) into dishes/; only admins replace or delete files.
create policy catalog_images_staff_insert on storage.objects for insert
  with check (
    bucket_id = 'catalog'
    and name like 'dishes/%'
    and exists (select 1 from public.stall_staff where user_id = auth.uid())
  );

-- ============================================================ open now?
-- Is this time inside the truck's hours? (park time zone; handles past-midnight closing)
create or replace function public._within_hours(p_stall_id text, p_at timestamptz)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_local timestamp;
  v_dow int;
  v_t time;
begin
  select p_at at time zone timezone into v_local from public.park_settings where id = 1;
  v_dow := extract(dow from v_local)::int;
  v_t := v_local::time;
  return exists (
    select 1 from public.stall_hours h
    where h.stall_id = p_stall_id
      and (
        (h.weekday = v_dow and h.opens < h.closes and v_t >= h.opens and v_t < h.closes)
        or (h.weekday = v_dow and h.opens > h.closes and v_t >= h.opens)
        or (h.weekday = (v_dow + 6) % 7 and h.opens > h.closes and v_t < h.closes)
      )
  );
end;
$$;

-- Why a truck is not taking orders at p_at, or null when it is.
-- 'closed' (switched off or inactive), 'paused', 'outside_hours'
create or replace function public._stall_closed_reason(p_stall_id text, p_at timestamptz default now())
returns text language plpgsql stable security definer set search_path = public as $$
declare
  s public.stalls;
begin
  select * into s from public.stalls where id = p_stall_id;
  if not found or not s.is_active or not s.is_open then return 'closed'; end if;
  if s.paused_until is not null and s.paused_until > p_at then return 'paused'; end if;
  if s.auto_hours and not public._within_hours(s.id, p_at) then return 'outside_hours'; end if;
  return null;
end;
$$;

-- For menus and truck cards: one row per active truck.
create or replace function public.stall_status()
returns table (stall_id text, accepting boolean, reason text, paused_until timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, r.reason is null, r.reason, case when s.paused_until > now() then s.paused_until end
  from public.stalls s
  cross join lateral (select public._stall_closed_reason(s.id) as reason) r
  where s.is_active
  order by s.sort_order;
$$;

-- Typical wait per truck, from today's real tickets only. typical_prep_mins is null until
-- there are at least 3 tickets made ready in the last 3 hours.
create or replace function public.stall_wait_times()
returns table (stall_id text, open_tickets int, typical_prep_mins int)
language sql stable security definer set search_path = public as $$
  select
    s.id,
    (select count(*)::int from public.stall_orders so where so.stall_id = s.id and so.status in ('placed', 'preparing')),
    (
      select case when count(*) >= 3
        then greatest(1, round(avg(extract(epoch from (so.ready_at - coalesce(so.accepted_at, so.placed_at))) / 60.0)))::int
      end
      from public.stall_orders so
      where so.stall_id = s.id and so.ready_at > now() - interval '3 hours' and coalesce(so.accepted_at, so.placed_at) is not null
    )
  from public.stalls s
  where s.is_active
  order by s.sort_order;
$$;

-- Stall staff: pause new orders for p_minutes (1–240); 0 resumes now.
create or replace function public.pause_stall(p_stall_id text, p_minutes int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_until timestamptz;
begin
  if not public.is_staff_of(p_stall_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 240 then raise exception 'bad_minutes'; end if;
  v_until := case when p_minutes = 0 then null else now() + make_interval(mins => p_minutes) end;
  update public.stalls set paused_until = v_until where id = p_stall_id;
  if not found then raise exception 'not_found'; end if;
  return v_until;
end;
$$;

-- Stall staff: replace the week's hours. p_hours = [{weekday, opens: "17:00", closes: "23:00"}].
-- p_auto = true makes the hours open and close ordering; false keeps the manual switch only.
create or replace function public.set_stall_hours(p_stall_id text, p_auto boolean, p_hours jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff_of(p_stall_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.stalls where id = p_stall_id) then raise exception 'not_found'; end if;
  if jsonb_typeof(coalesce(p_hours, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_hours, '[]'::jsonb)) > 28 then
    raise exception 'bad_hours';
  end if;
  delete from public.stall_hours where stall_id = p_stall_id;
  begin
    insert into public.stall_hours (stall_id, weekday, opens, closes)
    select p_stall_id, h.weekday, h.opens::time, h.closes::time
    from jsonb_to_recordset(coalesce(p_hours, '[]'::jsonb)) as h (weekday int, opens text, closes text);
  exception when others then
    raise exception 'bad_hours';
  end;
  if p_auto and not exists (select 1 from public.stall_hours where stall_id = p_stall_id) then
    raise exception 'bad_hours';
  end if;
  update public.stalls set auto_hours = coalesce(p_auto, false) where id = p_stall_id;
end;
$$;

-- ============================================================ pricing cart lines
-- Checks and prices cart lines, options included. Returns
-- [{menu_item_id, stall_id, name, diet, qty, note, unit_price_cents, options:[{group,name,price_cents}]}].
-- p_strict (orders) also refuses sold-out dishes and options; quotes skip that.
-- errors: cart_empty, cart_too_big, item_not_found, bad_quantity, item_unavailable,
--   bad_options, option_unavailable, option_required, too_many_options
create or replace function public._price_lines(p_items jsonb, p_strict boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l record;
  g record;
  v_mi public.menu_items;
  v_ids text[];
  v_count int;
  v_extra int;
  v_opts jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_empty';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'cart_too_big'; end if;

  for l in select * from jsonb_to_recordset(p_items) as x (menu_item_id text, qty int, note text, option_ids jsonb) loop
    select * into v_mi from public.menu_items where id = l.menu_item_id;
    if not found then raise exception 'item_not_found'; end if;
    if l.qty is null or l.qty not between 1 and 50 then raise exception 'bad_quantity'; end if;
    if p_strict and not v_mi.is_available then raise exception 'item_unavailable'; end if;

    if l.option_ids is not null and jsonb_typeof(l.option_ids) <> 'array' then raise exception 'bad_options'; end if;
    v_ids := array(select jsonb_array_elements_text(coalesce(l.option_ids, '[]'::jsonb)));
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x) then raise exception 'bad_options'; end if;

    select count(*) into v_count
    from public.menu_options o join public.menu_option_groups gr on gr.id = o.group_id
    where o.id = any (v_ids) and gr.menu_item_id = v_mi.id;
    if v_count <> cardinality(v_ids) then raise exception 'bad_options'; end if;

    if p_strict and exists (select 1 from public.menu_options o where o.id = any (v_ids) and not o.is_available) then
      raise exception 'option_unavailable';
    end if;

    for g in
      select gr.min_select, gr.max_select,
        (select count(*) from public.menu_options o where o.group_id = gr.id and o.id = any (v_ids)) as picked
      from public.menu_option_groups gr where gr.menu_item_id = v_mi.id
    loop
      if g.picked < g.min_select then raise exception 'option_required'; end if;
      if g.picked > g.max_select then raise exception 'too_many_options'; end if;
    end loop;

    select
      coalesce(jsonb_agg(jsonb_build_object('group', gr.name, 'name', o.name, 'price_cents', o.price_cents) order by gr.sort_order, o.sort_order), '[]'::jsonb),
      coalesce(sum(o.price_cents), 0)::int
    into v_opts, v_extra
    from public.menu_options o join public.menu_option_groups gr on gr.id = o.group_id
    where o.id = any (v_ids);

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_mi.id,
      'stall_id', v_mi.stall_id,
      'name', v_mi.name,
      'diet', v_mi.diet,
      'qty', l.qty,
      'note', nullif(btrim(coalesce(l.note, '')), ''),
      'unit_price_cents', v_mi.price_cents + v_extra,
      'options', v_opts
    ));
  end loop;
  return v_out;
end;
$$;

-- ============================================================ coupons, now on priced lines
drop function public._coupon_quote(text, uuid, jsonb);
create or replace function public._coupon_quote(p_code text, p_uid uuid, p_lines jsonb)
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
  if not coalesce(v_settings.coupons_enabled, false) then raise exception 'coupons_disabled'; end if;

  select * into c from public.coupons where coupons.code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'coupon_not_found'; end if;
  if not c.is_active then raise exception 'coupon_inactive'; end if;
  if c.starts_at is not null and now() < c.starts_at then raise exception 'coupon_not_started'; end if;
  if c.ends_at is not null and now() >= c.ends_at then raise exception 'coupon_expired'; end if;

  select coalesce(sum(l.unit_price_cents * l.qty), 0) into v_eligible
  from jsonb_to_recordset(p_lines) as l (stall_id text, qty int, unit_price_cents int)
  where c.stall_id is null or l.stall_id = c.stall_id;

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

-- Cart preview: same as v1.5, and items may now carry option_ids.
create or replace function public.quote_coupon(p_code text, p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q record;
begin
  select * into q from public._coupon_quote(p_code, auth.uid(), public._price_lines(p_items, false));
  return jsonb_build_object('code', q.code, 'title', q.title, 'stall_id', q.stall_id, 'discount_cents', q.discount_cents);
end;
$$;

-- ============================================================ place_order v1.6
-- payload: { fulfilment, table_no, customer_name, customer_phone, note, payment_method, tip_cents,
--            coupon_code?, pickup_at? (ISO time, today, 10 min – 12 h ahead),
--            items: [{ menu_item_id, qty, note?, option_ids?: [text] }] }
-- returns: { order_id, order_no, total_cents, discount_cents }
-- new errors: stall_paused, outside_hours, scheduling_unavailable, bad_pickup_time, plus the _price_lines ones
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
  v_pickup_at timestamptz;
  v_lines jsonb;
  v_stalls int;
  v_stall_no int := 0;
  v_reason text;
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
  if v_uid is null then raise exception 'sign_in_required' using errcode = '28000'; end if;

  select * into v_settings from public.park_settings where id = 1;
  if not found or not v_settings.ordering_enabled then raise exception 'ordering_closed'; end if;

  v_fulfilment := (payload ->> 'fulfilment')::public.fulfilment;
  v_method := (payload ->> 'payment_method')::public.payment_method;
  v_online := v_method = 'online';

  if v_name is null then raise exception 'name_required'; end if;
  if v_fulfilment = 'table' then
    if not v_settings.table_service_enabled then raise exception 'table_service_unavailable'; end if;
    if v_table is null then raise exception 'table_required'; end if;
  else
    v_table := null;
  end if;

  if nullif(btrim(payload ->> 'pickup_at'), '') is not null then
    if not v_settings.scheduled_orders_enabled then raise exception 'scheduling_unavailable'; end if;
    begin
      v_pickup_at := (payload ->> 'pickup_at')::timestamptz;
    exception when others then
      raise exception 'bad_pickup_time';
    end;
    if v_pickup_at < now() + interval '10 minutes' or v_pickup_at > now() + interval '12 hours'
      or (v_pickup_at at time zone v_settings.timezone)::date <> (now() at time zone v_settings.timezone)::date then
      raise exception 'bad_pickup_time';
    end if;
  end if;

  v_lines := public._price_lines(payload -> 'items', true);

  -- every truck in the cart must be taking orders (at the pickup time, for a later order)
  for v_stall in select distinct l.stall_id from jsonb_to_recordset(v_lines) as l (stall_id text) loop
    v_reason := public._stall_closed_reason(v_stall.stall_id, coalesce(v_pickup_at, now()));
    if v_reason = 'paused' then raise exception 'stall_paused'; end if;
    if v_reason = 'outside_hours' then raise exception 'outside_hours'; end if;
    if v_reason is not null then raise exception 'stall_closed'; end if;
  end loop;

  select count(distinct l.stall_id), coalesce(sum(l.unit_price_cents * l.qty), 0)::int
  into v_stalls, v_item_total
  from jsonb_to_recordset(v_lines) as l (stall_id text, qty int, unit_price_cents int);

  if v_code is not null then
    -- one order at a time per coupon, so usage limits hold under load
    perform pg_advisory_xact_lock(hashtext('coupon:' || v_code));
    select * into v_coupon from public._coupon_quote(v_code, v_uid, v_lines);
    v_coupon_id := v_coupon.coupon_id;
    v_coupon_code := v_coupon.code;
    v_coupon_stall := v_coupon.stall_id;
    v_discount := v_coupon.discount_cents;
    select coalesce(sum(l.unit_price_cents * l.qty), 0)::int into v_eligible_total
    from jsonb_to_recordset(v_lines) as l (stall_id text, qty int, unit_price_cents int)
    where v_coupon_stall is null or l.stall_id = v_coupon_stall;
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
    id, order_no, customer_id, customer_name, customer_phone, fulfilment, table_no, note, pickup_at,
    item_total_cents, discount_cents, coupon_id, coupon_code, tax_cents, service_fee_cents, tip_cents, total_cents,
    payment_method, payment_status, status
  ) values (
    v_order_id, v_order_no, v_uid, v_name, v_phone, v_fulfilment, v_table, v_note, v_pickup_at,
    v_item_total, v_discount, v_coupon_id, v_coupon_code, v_tax, v_settings.service_fee_cents, v_tip, v_total,
    v_method, 'unpaid', case when v_online then 'awaiting_payment' else 'active' end::public.order_status
  );

  v_today := (now() at time zone v_settings.timezone)::date;

  for v_stall in
    select l.stall_id, sum(l.unit_price_cents * l.qty)::int as subtotal
    from jsonb_to_recordset(v_lines) as l (stall_id text, qty int, unit_price_cents int)
    group by l.stall_id
    order by l.stall_id
  loop
    perform pg_advisory_xact_lock(hashtext('stall-token:' || v_stall.stall_id));

    select coalesce(max(token_no), 0) + 1 into v_token
    from public.stall_orders
    where stall_id = v_stall.stall_id
      and (created_at at time zone v_settings.timezone)::date = v_today;

    v_stall_no := v_stall_no + 1;

    if v_discount = 0 or (v_coupon_stall is not null and v_coupon_stall <> v_stall.stall_id) then
      v_stall_discount := 0;
    elsif v_stall_no = v_stalls or v_coupon_stall is not null then
      v_stall_discount := v_discount_left;
    else
      v_stall_discount := least(round(v_discount * v_stall.subtotal / greatest(v_eligible_total, 1)::numeric)::int, v_discount_left);
    end if;
    v_discount_left := v_discount_left - v_stall_discount;

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
      v_stall.subtotal, v_stall_discount, v_stall_tax,
      case when v_online then null else now() end
    )
    returning id into v_stall_order_id;

    insert into public.order_items (stall_order_id, menu_item_id, name, diet, unit_price_cents, qty, note, options)
    select v_stall_order_id, l.menu_item_id, l.name, l.diet::public.diet, l.unit_price_cents, l.qty, l.note, l.options
    from jsonb_to_recordset(v_lines) as l (menu_item_id text, stall_id text, name text, diet text, qty int, note text, unit_price_cents int, options jsonb)
    where l.stall_id = v_stall.stall_id;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total_cents', v_total, 'discount_cents', v_discount);
end;
$$;

-- ============================================================ refunds
-- Queues a refund for a paid online order. Amount is capped at what is still unrefunded.
create or replace function public._queue_refund(p_order_id uuid, p_stall_order_id uuid, p_amount int, p_reason text, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_open int;
  v_amount int;
  v_id uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or o.payment_method <> 'online' or o.payment_status = 'unpaid' then return null; end if;
  select coalesce(sum(amount_cents), 0) into v_open from public.refunds where order_id = p_order_id and status <> 'failed';
  v_amount := least(p_amount, o.total_cents - v_open);
  if v_amount <= 0 then return null; end if;
  insert into public.refunds (order_id, stall_order_id, amount_cents, reason, requested_by)
  values (p_order_id, p_stall_order_id, v_amount, p_reason, p_by)
  returning id into v_id;
  return v_id;
end;
$$;

-- What a truck charges for its part of an order.
create or replace function public._stall_order_due(p_stall_order_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select subtotal_cents - discount_cents + tax_cents from public.stall_orders where id = p_stall_order_id;
$$;

-- Admin: refund part or all of a paid online order. p_stall_order_id may be null.
-- errors: forbidden, not_found, not_refundable, bad_amount
create or replace function public.request_refund(p_order_id uuid, p_stall_order_id uuid, p_amount_cents int, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_open int;
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order_id;
  if not found then raise exception 'not_found'; end if;
  if o.payment_method <> 'online' or o.payment_status = 'unpaid' then raise exception 'not_refundable'; end if;
  if p_stall_order_id is not null and not exists (select 1 from public.stall_orders where id = p_stall_order_id and order_id = p_order_id) then
    raise exception 'not_found';
  end if;
  select coalesce(sum(amount_cents), 0) into v_open from public.refunds where order_id = p_order_id and status <> 'failed';
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > o.total_cents - v_open then raise exception 'bad_amount'; end if;
  insert into public.refunds (order_id, stall_order_id, amount_cents, reason, requested_by)
  values (p_order_id, p_stall_order_id, p_amount_cents, coalesce(nullif(btrim(p_reason), ''), 'Refund'), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Payment server only (service key), after asking Stripe for the refund.
create or replace function public.record_refund_result(p_refund_id uuid, p_succeeded boolean, p_stripe_refund_id text, p_error text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.refunds;
begin
  select * into r from public.refunds where id = p_refund_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending' then return; end if;
  update public.refunds
  set status = case when p_succeeded then 'succeeded' else 'failed' end::public.refund_status,
      stripe_refund_id = p_stripe_refund_id, error = p_error, processed_at = now()
  where id = p_refund_id;
  if p_succeeded then
    update public.orders
    set refunded_cents = refunded_cents + r.amount_cents,
        payment_status = case when refunded_cents + r.amount_cents >= total_cents then 'refunded' else payment_status end::public.payment_status
    where id = r.order_id;
    if r.stall_order_id is not null then
      update public.stall_orders set refunded_cents = refunded_cents + r.amount_cents where id = r.stall_order_id;
    end if;
  end if;
end;
$$;

-- cancel_order: as before, and a paid order queues its refund.
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

  perform public._queue_refund(p_order_id, null, 2147483647, 'Order cancelled', auth.uid());
end;
$$;

-- set_stall_order_status gains p_prep_mins (when accepting) and queues a refund when a
-- truck rejects its part of a paid online order. Two-argument calls still work.
drop function public.set_stall_order_status(uuid, public.ticket_status);
create or replace function public.set_stall_order_status(p_stall_order_id uuid, p_status public.ticket_status, p_prep_mins int default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_so public.stall_orders;
  v_prep int;
  v_order_status public.order_status;
begin
  select * into v_so from public.stall_orders where id = p_stall_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.is_staff_of(v_so.stall_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (
    (v_so.status = 'placed' and p_status in ('preparing', 'cancelled'))
    or (v_so.status = 'preparing' and p_status in ('ready', 'cancelled'))
    or (v_so.status = 'ready' and p_status = 'completed')
  ) then
    raise exception 'invalid_transition';
  end if;
  if p_prep_mins is not null and p_prep_mins not between 1 and 120 then raise exception 'bad_prep_time'; end if;

  if p_status = 'preparing' then
    select coalesce(p_prep_mins, s.avg_prep_mins) into v_prep from public.stalls s where s.id = v_so.stall_id;
  end if;

  update public.stall_orders
  set status = p_status,
      accepted_at = case when p_status = 'preparing' then now() else accepted_at end,
      prep_mins = case when p_status = 'preparing' then v_prep else prep_mins end,
      ready_by = case when p_status = 'preparing' and v_prep is not null then now() + make_interval(mins => v_prep) else ready_by end,
      ready_at = case when p_status = 'ready' then now() else ready_at end,
      completed_at = case when p_status in ('completed', 'cancelled') then now() else completed_at end
  where id = p_stall_order_id;

  perform public._sync_order_status(v_so.order_id);

  if p_status = 'cancelled' then
    perform public._queue_refund(v_so.order_id, v_so.id, public._stall_order_due(v_so.id), 'Rejected by the truck', auth.uid());
    -- every truck rejected: the service fee and tip go back too
    select status into v_order_status from public.orders where id = v_so.order_id;
    if v_order_status = 'cancelled' then
      perform public._queue_refund(v_so.order_id, null, 2147483647, 'Order cancelled', auth.uid());
    end if;
  end if;
end;
$$;

-- ============================================================ ratings
-- Customer rates one truck's part of their order after it is completed. Rating again updates it.
-- errors: not_found, not_completed, bad_rating
create or replace function public.rate_stall_order(p_stall_order_id uuid, p_stars int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_so public.stall_orders;
  v_customer uuid;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  select so.* into v_so from public.stall_orders so where so.id = p_stall_order_id;
  if not found then raise exception 'not_found'; end if;
  select customer_id into v_customer from public.orders where id = v_so.order_id;
  if v_customer is distinct from auth.uid() then raise exception 'not_found'; end if;
  if v_so.status <> 'completed' then raise exception 'not_completed'; end if;
  if p_stars is null or p_stars not between 1 and 5 or char_length(coalesce(v_comment, '')) > 500 then raise exception 'bad_rating'; end if;

  insert into public.order_ratings (stall_order_id, order_id, stall_id, customer_id, stars, comment)
  values (v_so.id, v_so.order_id, v_so.stall_id, v_customer, p_stars, v_comment)
  on conflict (stall_order_id) do update set stars = excluded.stars, comment = excluded.comment, updated_at = now();
end;
$$;

-- Average stars per truck. Only shown to everyone once park_settings.ratings_public is on;
-- until then a truck sees its own and the admin sees all.
create or replace function public.stall_rating_summary()
returns table (stall_id text, avg_stars numeric, ratings int)
language sql stable security definer set search_path = public as $$
  select r.stall_id, round(avg(r.stars)::numeric, 1), count(*)::int
  from public.order_ratings r
  where (select ratings_public from public.park_settings where id = 1) or public.is_staff_of(r.stall_id)
  group by r.stall_id;
$$;

-- ============================================================ device tokens
create or replace function public.register_device(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required' using errcode = '28000'; end if;
  if p_platform not in ('android', 'ios', 'web') or char_length(coalesce(p_token, '')) not between 10 and 4096 then
    raise exception 'bad_device';
  end if;
  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
  -- a phone moves to whoever signed in on it last
  insert into public.device_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

create or replace function public.unregister_device(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.device_tokens where token = p_token and user_id = auth.uid();
$$;

-- ============================================================ reports
-- Who may see numbers: the admin for the whole park (p_stall_id null) or any truck;
-- a truck's staff for their own truck only. Range at most 366 days, in the park's time zone.
create or replace function public._report_guard(p_from date, p_to date, p_stall_id text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'bad_range'; end if;
  if p_stall_id is null then
    if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not public.is_staff_of(p_stall_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Sales per day per truck. Counts tickets that reached the truck (not pending, not cancelled).
-- charged = items − discount + tax (what the truck collects); service fee and tips are not included.
create or replace function public.report_sales(p_from date, p_to date, p_stall_id text default null)
returns table (
  day date, stall_id text, orders int, items int, item_cents int, discount_cents int, tax_cents int,
  charged_cents int, online_cents int, at_stall_cents int, refunded_cents int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
begin
  perform public._report_guard(p_from, p_to, p_stall_id);
  select timezone into v_tz from public.park_settings where id = 1;
  return query
  select
    (so.created_at at time zone v_tz)::date as d,
    so.stall_id,
    count(*)::int,
    coalesce(sum((select sum(oi.qty) from public.order_items oi where oi.stall_order_id = so.id)), 0)::int,
    sum(so.subtotal_cents)::int,
    sum(so.discount_cents)::int,
    sum(so.tax_cents)::int,
    sum(so.subtotal_cents - so.discount_cents + so.tax_cents)::int,
    coalesce(sum(so.subtotal_cents - so.discount_cents + so.tax_cents) filter (where o.payment_method = 'online'), 0)::int,
    coalesce(sum(so.subtotal_cents - so.discount_cents + so.tax_cents) filter (where o.payment_method = 'pay_at_stall'), 0)::int,
    sum(so.refunded_cents)::int
  from public.stall_orders so
  join public.orders o on o.id = so.order_id
  where so.status not in ('pending', 'cancelled')
    and (so.created_at at time zone v_tz)::date between p_from and p_to
    and (p_stall_id is null or so.stall_id = p_stall_id)
  group by 1, 2
  order by 1, 2;
end;
$$;

-- Dishes sold in the range, best sellers first.
create or replace function public.report_items(p_from date, p_to date, p_stall_id text default null)
returns table (stall_id text, menu_item_id text, name text, qty int, sales_cents int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
begin
  perform public._report_guard(p_from, p_to, p_stall_id);
  select timezone into v_tz from public.park_settings where id = 1;
  return query
  select so.stall_id, oi.menu_item_id, oi.name, sum(oi.qty)::int, sum(oi.qty * oi.unit_price_cents)::int
  from public.order_items oi
  join public.stall_orders so on so.id = oi.stall_order_id
  where so.status not in ('pending', 'cancelled')
    and (so.created_at at time zone v_tz)::date between p_from and p_to
    and (p_stall_id is null or so.stall_id = p_stall_id)
  group by so.stall_id, oi.menu_item_id, oi.name
  order by 4 desc, 5 desc;
end;
$$;

-- Orders by weekday (0 = Sunday) and hour, for "busiest hours".
create or replace function public.report_hours(p_from date, p_to date, p_stall_id text default null)
returns table (weekday int, hour int, orders int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text;
begin
  perform public._report_guard(p_from, p_to, p_stall_id);
  select timezone into v_tz from public.park_settings where id = 1;
  return query
  select extract(dow from so.created_at at time zone v_tz)::int, extract(hour from so.created_at at time zone v_tz)::int, count(distinct so.order_id)::int
  from public.stall_orders so
  where so.status not in ('pending', 'cancelled')
    and (so.created_at at time zone v_tz)::date between p_from and p_to
    and (p_stall_id is null or so.stall_id = p_stall_id)
  group by 1, 2
  order by 1, 2;
end;
$$;

-- ============================================================ permissions
revoke all on function public._option_group_stall(text), public._menu_item_stall(text),
  public._within_hours(text, timestamptz), public._stall_closed_reason(text, timestamptz),
  public._price_lines(jsonb, boolean), public._coupon_quote(text, uuid, jsonb),
  public._queue_refund(uuid, uuid, int, text, uuid), public._stall_order_due(uuid),
  public._report_guard(date, date, text) from public, anon, authenticated;
-- row policies call these two as the signed-in user
grant execute on function public._option_group_stall(text), public._menu_item_stall(text) to anon, authenticated;

revoke all on function public.stall_status(), public.stall_wait_times(), public.stall_rating_summary() from public;
grant execute on function public.stall_status(), public.stall_wait_times(), public.stall_rating_summary() to anon, authenticated;

revoke all on function public.quote_coupon(text, jsonb) from public;
grant execute on function public.quote_coupon(text, jsonb) to anon, authenticated;
revoke all on function public.place_order(jsonb), public.cancel_order(uuid),
  public.set_stall_order_status(uuid, public.ticket_status, int),
  public.pause_stall(text, int), public.set_stall_hours(text, boolean, jsonb),
  public.request_refund(uuid, uuid, int, text), public.rate_stall_order(uuid, int, text),
  public.register_device(text, text), public.unregister_device(text),
  public.report_sales(date, date, text), public.report_items(date, date, text), public.report_hours(date, date, text)
  from public, anon;
grant execute on function public.place_order(jsonb), public.cancel_order(uuid),
  public.set_stall_order_status(uuid, public.ticket_status, int),
  public.pause_stall(text, int), public.set_stall_hours(text, boolean, jsonb),
  public.request_refund(uuid, uuid, int, text), public.rate_stall_order(uuid, int, text),
  public.register_device(text, text), public.unregister_device(text),
  public.report_sales(date, date, text), public.report_items(date, date, text), public.report_hours(date, date, text)
  to authenticated;
revoke all on function public.record_refund_result(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.record_refund_result(uuid, boolean, text, text) to service_role;

alter publication supabase_realtime add table public.refunds;
