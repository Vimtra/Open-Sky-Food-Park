"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCatalog } from "./hooks";
import type { Fulfilment, MenuItem, PaymentMethod, Stall } from "./types";

export const MAX_QTY = 20;

interface CartState {
  /** menu item id -> quantity */
  lines: Record<string, number>;
  fulfilment: Fulfilment;
  tableNo: string;
  note: string;
  paymentMethod: PaymentMethod;
  hydrated: boolean;
  add: (itemId: string) => void;
  decrement: (itemId: string) => void;
  remove: (itemId: string) => void;
  clear: () => void;
  set: (patch: Partial<Pick<CartState, "fulfilment" | "tableNo" | "note" | "paymentMethod">>) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      fulfilment: "pickup",
      tableNo: "",
      note: "",
      paymentMethod: "online",
      hydrated: false,
      add: (id) => set((s) => ({ lines: { ...s.lines, [id]: Math.min(MAX_QTY, (s.lines[id] ?? 0) + 1) } })),
      decrement: (id) =>
        set((s) => {
          const next = { ...s.lines };
          if ((next[id] ?? 0) <= 1) delete next[id];
          else next[id] -= 1;
          return { lines: next };
        }),
      remove: (id) =>
        set((s) => {
          const next = { ...s.lines };
          delete next[id];
          return { lines: next };
        }),
      clear: () => set({ lines: {}, note: "" }),
      set: (patch) => set(patch),
    }),
    {
      name: "osfp.cart",
      version: 1,
      // Hydrated from an effect in <Providers> so the first client render matches the server.
      skipHydration: true,
      partialize: ({ lines, fulfilment, tableNo, note, paymentMethod }) => ({ lines, fulfilment, tableNo, note, paymentMethod }),
      onRehydrateStorage: () => () => useCart.setState({ hydrated: true }),
    },
  ),
);

export interface CartLine {
  item: MenuItem;
  qty: number;
  /** False when the item sold out or its stall closed after it was added. */
  orderable: boolean;
}

export interface CartGroup {
  stall: Stall;
  lines: CartLine[];
  subtotal_cents: number;
}

/** The cart joined with the current catalog: grouped by stall, with totals. */
export function useCartView() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const { index } = useCatalog();

  return useMemo(() => {
    const groups = new Map<string, CartGroup>();
    let count = 0;
    let total = 0;
    let blocked = false;
    if (index) {
      for (const [id, qty] of Object.entries(lines)) {
        const item = index.itemById.get(id);
        const stall = item && index.stallById.get(item.stall_id);
        if (!item || !stall) continue;
        const orderable = item.is_available && stall.is_open && stall.is_active;
        if (!orderable) blocked = true;
        const group = groups.get(stall.id) ?? { stall, lines: [], subtotal_cents: 0 };
        group.lines.push({ item, qty, orderable });
        group.subtotal_cents += item.price_cents * qty;
        groups.set(stall.id, group);
        count += qty;
        total += item.price_cents * qty;
      }
    }
    const ordered = [...groups.values()].sort((a, b) => a.stall.sort_order - b.stall.sort_order);
    const sectionOrder = new Map(index?.catalog.menu_categories.map((c) => [c.id, c.sort_order]));
    const section = (l: CartLine) => sectionOrder.get(l.item.category_id) ?? 0;
    ordered.forEach((g) => g.lines.sort((a, b) => section(a) - section(b) || a.item.sort_order - b.item.sort_order));
    return { groups: ordered, count, item_total_cents: total, blocked, ready: hydrated && Boolean(index) };
  }, [lines, hydrated, index]);
}
