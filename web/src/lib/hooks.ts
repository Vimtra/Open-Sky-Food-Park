"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { backend, type Area, type Unsubscribe } from "./backend";
import { indexOptions, type OptionGroupView } from "./options";
import type { Catalog, MenuCategory, MenuItem, Stall, StallStatus, StallWait } from "./types";

// One live subscription per key, shared by every component that uses the hook.
const live = new Map<string, { count: number; stop: Unsubscribe }>();

function useLive(key: string | null, start: (onChange: () => void) => Unsubscribe) {
  useEffect(() => {
    if (!key) return;
    let entry = live.get(key);
    if (!entry) {
      entry = { count: 0, stop: start(() => void globalMutate(key)) };
      live.set(key, entry);
    }
    entry.count += 1;
    return () => {
      const current = live.get(key);
      if (!current) return;
      current.count -= 1;
      if (current.count === 0) {
        current.stop();
        live.delete(key);
      }
    };
    // `start` is stable in behaviour for a given key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export interface CatalogIndex {
  catalog: Catalog;
  stalls: Stall[];
  stallById: Map<string, Stall>;
  stallBySlug: Map<string, Stall>;
  itemById: Map<string, MenuItem>;
  itemsByStall: Map<string, MenuItem[]>;
  categoriesByStall: Map<string, MenuCategory[]>;
  /** v1.6: a dish's option groups (empty when it has none). */
  optionsByItem: Map<string, OptionGroupView[]>;
}

function indexCatalog(catalog: Catalog): CatalogIndex {
  const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;
  const stalls = catalog.stalls.filter((s) => s.is_active).sort(bySort);
  const itemsByStall = new Map<string, MenuItem[]>();
  for (const item of [...catalog.menu_items].sort(bySort)) {
    itemsByStall.set(item.stall_id, [...(itemsByStall.get(item.stall_id) ?? []), item]);
  }
  const categoriesByStall = new Map<string, MenuCategory[]>();
  for (const c of [...catalog.menu_categories].sort(bySort)) {
    categoriesByStall.set(c.stall_id, [...(categoriesByStall.get(c.stall_id) ?? []), c]);
  }
  return {
    catalog,
    stalls,
    stallById: new Map(catalog.stalls.map((s) => [s.id, s])),
    stallBySlug: new Map(catalog.stalls.map((s) => [s.slug, s])),
    itemById: new Map(catalog.menu_items.map((m) => [m.id, m])),
    itemsByStall,
    categoriesByStall,
    optionsByItem: indexOptions(catalog),
  };
}

export function useCatalog() {
  const { data, error, isLoading, mutate } = useSWR("catalog", () => backend().getCatalog(), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  useLive("catalog", (onChange) => backend().onCatalogChange(onChange));
  const index = useMemo(() => (data ? indexCatalog(data) : null), [data]);
  return { index, error, isLoading, reload: mutate };
}

export function useSession(area: Area = "customer") {
  const key = `session:${area}`;
  const { data, isLoading, mutate } = useSWR(key, () => backend().getSession(area), { revalidateOnFocus: false });
  useLive(key, (onChange) => backend().onSessionChange(onChange));
  return { session: data ?? null, isLoading, reload: mutate };
}

export function useMyOrders(enabled = true) {
  const key = enabled ? "orders:mine" : null;
  const { data, error, isLoading, mutate } = useSWR(key, () => backend().listMyOrders());
  useLive(key, (onChange) => backend().onOrdersChange(onChange));
  return { orders: data, error, isLoading, reload: mutate };
}

export function useOrder(id: string | null) {
  const key = id ? `order:${id}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, () => backend().getOrder(id!));
  useLive(key, (onChange) => backend().onOrdersChange(onChange));
  return { order: data, error, isLoading, reload: mutate };
}

export function useStallTickets(stallId: string | null) {
  const key = stallId ? `tickets:${stallId}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, () => backend().listStallTickets(stallId!), {
    refreshInterval: 30_000,
  });
  useLive(key, (onChange) => backend().onOrdersChange(onChange));
  return { tickets: data, error, isLoading, reload: mutate };
}

export function useAllOrders(enabled = true) {
  const key = enabled ? "orders:all" : null;
  const { data, error, isLoading, mutate } = useSWR(key, () => backend().listAllOrders(), { refreshInterval: 30_000 });
  useLive(key, (onChange) => backend().onOrdersChange(onChange));
  return { orders: data, error, isLoading, reload: mutate };
}

export function useSupportRequests(enabled = true) {
  const key = enabled ? "support:all" : null;
  const { data, error, isLoading, mutate } = useSWR(key, () => backend().listSupportRequests(), { refreshInterval: 60_000 });
  useLive(key, (onChange) => backend().onSupportChange(onChange));
  return { requests: data, error, isLoading, reload: mutate };
}

/** Re-renders once a minute so "12 min ago" labels stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Which trucks are taking orders right now, and their typical wait. Refreshes every minute. */
export function useStallLive() {
  const { data: status } = useSWR("stalls:status", () => backend().getStallStatus(), { refreshInterval: 60_000, revalidateOnFocus: true });
  const { data: waits } = useSWR("stalls:waits", () => backend().getWaitTimes(), { refreshInterval: 120_000 });
  useLive("stalls:status", (onChange) => backend().onCatalogChange(onChange));
  return useMemo(
    () => ({
      status: new Map<string, StallStatus>((status ?? []).map((s) => [s.stall_id, s])),
      waits: new Map<string, StallWait>((waits ?? []).map((w) => [w.stall_id, w])),
      loaded: Boolean(status),
    }),
    [status, waits],
  );
}

/** The signed-in customer's favourites, with a toggle. Signed out: empty, and toggling asks to sign in. */
export function useFavorites() {
  const { session } = useSession("customer");
  const key = session ? `favorites:${session.user_id}` : null;
  const { data, mutate } = useSWR(key, () => backend().listFavorites(), { revalidateOnFocus: false });
  const items = useMemo(() => new Set((data ?? []).map((f) => f.menu_item_id).filter(Boolean) as string[]), [data]);
  const stalls = useMemo(() => new Set((data ?? []).map((f) => f.stall_id).filter(Boolean) as string[]), [data]);
  const toggle = async (target: { menu_item_id?: string; stall_id?: string }) => {
    const on = target.menu_item_id ? !items.has(target.menu_item_id) : !stalls.has(target.stall_id!);
    await backend().setFavorite(target, on);
    await mutate();
    return on;
  };
  return { signedIn: Boolean(session), list: data ?? [], items, stalls, toggle };
}

/** Average stars per truck; empty unless the owner made ratings public. */
export function useRatingSummary() {
  const { data } = useSWR("ratings:summary", () => backend().getRatingSummary(), { revalidateOnFocus: false });
  return useMemo(() => new Map((data ?? []).map((r) => [r.stall_id, r])), [data]);
}

