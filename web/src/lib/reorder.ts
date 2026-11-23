"use client";

import { useCart } from "./cart";
import { useCatalog, useStallLive } from "./hooks";
import { checkChoice, optionIdsFromCopy } from "./options";
import type { Order } from "./types";

export interface ReorderResult {
  added: number;
  /** Dish names that could not go back in, with why. */
  skipped: string[];
}

/**
 * "Order again": puts a past order's dishes back in the cart at today's prices, with the same
 * options and notes. Skips dishes that are gone, sold out, at a truck not taking orders, or whose
 * options no longer exist.
 */
export function useOrderAgain() {
  const { index } = useCatalog();
  const live = useStallLive();
  const add = useCart((s) => s.add);

  return (order: Order): ReorderResult => {
    const result: ReorderResult = { added: 0, skipped: [] };
    if (!index) return result;
    for (const so of order.stall_orders) {
      for (const line of so.order_items) {
        const item = line.menu_item_id ? index.itemById.get(line.menu_item_id) : undefined;
        const stall = item && index.stallById.get(item.stall_id);
        const status = stall && live.status.get(stall.id);
        if (!item || !stall || !stall.is_active) {
          result.skipped.push(`${line.name} (no longer on the menu)`);
          continue;
        }
        if (!item.is_available) {
          result.skipped.push(`${line.name} (sold out)`);
          continue;
        }
        if (!stall.is_open || (status && !status.accepting)) {
          result.skipped.push(`${line.name} (${stall.name} is not taking orders now)`);
          continue;
        }
        const groups = index.optionsByItem.get(item.id) ?? [];
        const ids = optionIdsFromCopy(groups, line.options ?? []);
        if (!ids || checkChoice(groups, ids, true)) {
          result.skipped.push(`${line.name} (its choices changed; add it from the menu)`);
          continue;
        }
        add(item.id, ids, line.qty, line.note ?? undefined);
        result.added += line.qty;
      }
    }
    return result;
  };
}
