"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { backend, type Area, type Unsubscribe } from "./backend";
import type { Catalog, MenuCategory, MenuItem, Stall } from "./types";

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

/** Re-renders once a minute so "12 min ago" labels stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
