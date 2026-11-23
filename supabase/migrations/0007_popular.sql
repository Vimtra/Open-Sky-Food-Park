-- Open Sky Food Park · contract version 1.6.1
-- "Popular" dishes for the search page, from real orders only (never invented).
-- Returns counts, not who ordered, so anyone may call it. A dish needs at least
-- 3 orders in the last 30 days to show; nothing shows until the park has orders.

create or replace function public.popular_items(p_limit int default 8)
returns table (menu_item_id text, orders int)
language sql stable security definer set search_path = public as $$
  select oi.menu_item_id, count(distinct so.order_id)::int
  from public.order_items oi
  join public.stall_orders so on so.id = oi.stall_order_id
  join public.menu_items mi on mi.id = oi.menu_item_id
  where so.status not in ('pending', 'cancelled')
    and so.created_at > now() - interval '30 days'
  group by oi.menu_item_id
  having count(distinct so.order_id) >= 3
  order by 2 desc, 1
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.popular_items(int) from public;
grant execute on function public.popular_items(int) to anon, authenticated;
