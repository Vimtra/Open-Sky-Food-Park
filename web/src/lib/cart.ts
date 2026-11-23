"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCatalog, useStallLive } from "./hooks";
import { checkChoice, priceWithOptions } from "./options";
import { availability } from "./stall-status";
import type { ChosenOption, Fulfilment, MenuItem, PaymentMethod, Stall } from "./types";

export const MAX_QTY = 20;

/** One cart line: a dish with its chosen options and its own note. */
export interface CartEntry {
  item_id: string;
  qty: number;
  option_ids: string[];
  note: string;
}

/** The same dish with different options is a different line. */
export const lineKey = (itemId: string, optionIds: string[] = []) => (optionIds.length ? `${itemId}|${[...optionIds].sort().join(",")}` : itemId);

interface CartState {
  /** line key -> line */
  lines: Record<string, CartEntry>;
  fulfilment: Fulfilment;
  tableNo: string;
  note: string;
  paymentMethod: PaymentMethod;
  /** v1.6: ISO time later today, or "" for as soon as possible. */
  pickupAt: string;
  hydrated: boolean;
  /** Adds qty of a dish with these options (a new line, or more of the same line). */
  add: (itemId: string, optionIds?: string[], qty?: number, note?: string) => void;
  /** One less of a line; removes it at zero. */
  decrement: (key: string) => void;
  remove: (key: string) => void;
  setLineNote: (key: string, note: string) => void;
  clear: () => void;
  set: (patch: Partial<Pick<CartState, "fulfilment" | "tableNo" | "note" | "paymentMethod" | "pickupAt">>) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      fulfilment: "pickup",
      tableNo: "",
      note: "",
      paymentMethod: "online",
      pickupAt: "",
      hydrated: false,
      add: (itemId, optionIds = [], qty = 1, note) =>
        set((s) => {
          const key = lineKey(itemId, optionIds);
          const prev = s.lines[key];
          const next: CartEntry = {
            item_id: itemId,
            option_ids: [...optionIds].sort(),
            qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + qty),
            note: note !== undefined && note.trim() ? note.trim().slice(0, 140) : (prev?.note ?? ""),
          };
          return { lines: { ...s.lines, [key]: next } };
        }),
      decrement: (key) =>
        set((s) => {
          const next = { ...s.lines };
          if (!next[key]) return {};
          if (next[key].qty <= 1) delete next[key];
          else next[key] = { ...next[key], qty: next[key].qty - 1 };
          return { lines: next };
        }),
      remove: (key) =>
        set((s) => {
          const next = { ...s.lines };
          delete next[key];
          return { lines: next };
        }),
      setLineNote: (key, note) =>
        set((s) => (s.lines[key] ? { lines: { ...s.lines, [key]: { ...s.lines[key], note: note.slice(0, 140) } } } : {})),
      clear: () => set({ lines: {}, note: "", pickupAt: "" }),
      set: (patch) => set(patch),
    }),
    {
      name: "osfp.cart",
      version: 2,
      // Hydrated from an effect in <Providers> so the first client render matches the server.
      skipHydration: true,
      partialize: ({ lines, fulfilment, tableNo, note, paymentMethod, pickupAt }) => ({ lines, fulfilment, tableNo, note, paymentMethod, pickupAt }),
      // v1 kept { itemId: qty }
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2 && state.lines && typeof state.lines === "object") {
          const lines: Record<string, CartEntry> = {};
          for (const [id, qty] of Object.entries(state.lines as Record<string, number>)) {
            if (typeof qty === "number" && qty > 0) lines[id] = { item_id: id, qty, option_ids: [], note: "" };
          }
          state.lines = lines;
        }
        return state as unknown as CartState;
      },
      onRehydrateStorage: () => () => useCart.setState({ hydrated: true }),
    },
  ),
);

/** How many of a dish are in the cart, over all its option lines. */
export function useItemQty(itemId: string) {
  return useCart((s) => (s.hydrated ? Object.values(s.lines).reduce((n, l) => (l.item_id === itemId ? n + l.qty : n), 0) : 0));
}

export interface CartLine {
  key: string;
  item: MenuItem;
  qty: number;
  option_ids: string[];
  options: ChosenOption[];
  note: string;
  /** Dish price plus its options. */
  unit_price_cents: number;
  /** False when the dish sold out, its options changed, or its truck stopped taking orders. */
  orderable: boolean;
  /** Why not, for the cart line. */
  problem: string | null;
}

export interface CartGroup {
  stall: Stall;
  lines: CartLine[];
  subtotal_cents: number;
  /** "Busy · back at 7:40", "Opens 5:00 PM", "~12 min" … */
  label: string | null;
  accepting: boolean;
}

/** The cart joined with the current catalog: grouped by stall, with totals. */
export function useCartView() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const { index } = useCatalog();
  const live = useStallLive();

  return useMemo(() => {
    const groups = new Map<string, CartGroup>();
    let count = 0;
    let total = 0;
    let blocked = false;
    if (index) {
      const tz = index.catalog.park.timezone;
      const hours = index.catalog.stall_hours ?? [];
      for (const [key, entry] of Object.entries(lines)) {
        const item = index.itemById.get(entry.item_id);
        const stall = item && index.stallById.get(item.stall_id);
        if (!item || !stall) continue;
        const optionGroups = index.optionsByItem.get(item.id) ?? [];
        const choiceProblem = checkChoice(optionGroups, entry.option_ids, true);
        const { unit_price_cents, chosen } = priceWithOptions(item, optionGroups, choiceProblem === "bad_options" ? [] : entry.option_ids);
        const avail = availability(stall, { status: live.status.get(stall.id), wait: live.waits.get(stall.id), hours, tz });
        const problem = !item.is_available ? "Sold out" : !avail.accepting ? (avail.label ?? "Truck closed") : choiceProblem ? "Choices changed: remove and add again" : null;
        const orderable = !problem;
        if (!orderable) blocked = true;
        const group = groups.get(stall.id) ?? { stall, lines: [], subtotal_cents: 0, label: avail.label, accepting: avail.accepting };
        group.lines.push({ key, item, qty: entry.qty, option_ids: entry.option_ids, options: chosen, note: entry.note, unit_price_cents, orderable, problem });
        group.subtotal_cents += unit_price_cents * entry.qty;
        groups.set(stall.id, group);
        count += entry.qty;
        total += unit_price_cents * entry.qty;
      }
    }
    const ordered = [...groups.values()].sort((a, b) => a.stall.sort_order - b.stall.sort_order);
    const sectionOrder = new Map(index?.catalog.menu_categories.map((c) => [c.id, c.sort_order]));
    const section = (l: CartLine) => sectionOrder.get(l.item.category_id) ?? 0;
    ordered.forEach((g) => g.lines.sort((a, b) => section(a) - section(b) || a.item.sort_order - b.item.sort_order || a.key.localeCompare(b.key)));
    return { groups: ordered, count, item_total_cents: total, blocked, ready: hydrated && Boolean(index) };
  }, [lines, hydrated, index, live]);
}
