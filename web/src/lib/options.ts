// Dish options (contract v1.6): the same rules as _price_lines() in supabase/migrations/0006_v16.sql,
// so the cart, the demo backend and the database agree on prices and errors.

import type { Catalog, ChosenOption, MenuItem, MenuOption, MenuOptionGroup } from "./types";

export interface OptionGroupView {
  group: MenuOptionGroup;
  options: MenuOption[];
}

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** Option groups of every dish, in menu order. */
export function indexOptions(catalog: Catalog): Map<string, OptionGroupView[]> {
  const optionsByGroup = new Map<string, MenuOption[]>();
  for (const o of [...(catalog.menu_options ?? [])].sort(bySort)) optionsByGroup.set(o.group_id, [...(optionsByGroup.get(o.group_id) ?? []), o]);
  const out = new Map<string, OptionGroupView[]>();
  for (const g of [...(catalog.menu_option_groups ?? [])].sort(bySort)) {
    out.set(g.menu_item_id, [...(out.get(g.menu_item_id) ?? []), { group: g, options: optionsByGroup.get(g.id) ?? [] }]);
  }
  return out;
}

/** "Pick 1", "Pick up to 3", "Pick 1 to 2", "Optional" */
export function ruleText(g: MenuOptionGroup): string {
  if (g.min_select === 0) return g.max_select === 1 ? "Optional · pick 1" : `Optional · up to ${g.max_select}`;
  if (g.min_select === g.max_select) return `Required · pick ${g.min_select}`;
  return `Required · pick ${g.min_select} to ${g.max_select}`;
}

/**
 * Checks a choice of options for one dish. Returns an error code from the contract, or null.
 * strict also refuses sold-out options (orders); quotes and the cart preview skip that.
 */
export function checkChoice(groups: OptionGroupView[], optionIds: string[], strict: boolean): string | null {
  if (new Set(optionIds).size !== optionIds.length) return "bad_options";
  const all = new Map(groups.flatMap((g) => g.options.map((o) => [o.id, o] as const)));
  if (optionIds.some((id) => !all.has(id))) return "bad_options";
  if (strict && optionIds.some((id) => !all.get(id)!.is_available)) return "option_unavailable";
  for (const g of groups) {
    const picked = g.options.filter((o) => optionIds.includes(o.id)).length;
    if (picked < g.group.min_select) return "option_required";
    if (picked > g.group.max_select) return "too_many_options";
  }
  return null;
}

/** Unit price with options, and the copy of the options an order line keeps. */
export function priceWithOptions(item: MenuItem, groups: OptionGroupView[], optionIds: string[]): { unit_price_cents: number; chosen: ChosenOption[] } {
  const chosen: ChosenOption[] = [];
  for (const g of groups) {
    for (const o of g.options) if (optionIds.includes(o.id)) chosen.push({ group: g.group.name, name: o.name, price_cents: o.price_cents });
  }
  return { unit_price_cents: item.price_cents + chosen.reduce((n, c) => n + c.price_cents, 0), chosen };
}

/** The options a dish starts with: each group's defaults (only available ones). */
export function defaultChoice(groups: OptionGroupView[]): string[] {
  return groups.flatMap((g) => g.options.filter((o) => o.is_default && o.is_available).slice(0, g.group.max_select).map((o) => o.id));
}

/** "Hot, Extra pulka (+$1.99)" */
export function optionsText(chosen: ChosenOption[], money: (c: number) => string): string {
  return chosen.map((c) => (c.price_cents ? `${c.name} (+${money(c.price_cents)})` : c.name)).join(", ");
}

/**
 * For "Order again": finds today's option ids for options copied on a past order line, matched by
 * group and option name. Returns null when an option no longer exists.
 */
export function optionIdsFromCopy(groups: OptionGroupView[], copy: ChosenOption[]): string[] | null {
  const ids: string[] = [];
  for (const c of copy) {
    const g = groups.find((x) => x.group.name === c.group);
    const o = g?.options.find((x) => x.name === c.name);
    if (!o) return null;
    ids.push(o.id);
  }
  return ids;
}
