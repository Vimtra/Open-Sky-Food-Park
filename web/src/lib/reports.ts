// Report maths shared by the demo backend and the admin Reports tab.
// The rules match report_sales / report_items / report_hours in supabase/migrations/0006_v16.sql:
// count tickets that reached the truck (not pending, not cancelled), days in the park's time zone,
// charged = items − discount + tax (what the truck collects; service fee and tips left out).

import type { HourRow, ItemSalesRow, Order, SalesRow } from "./types";

export const PARK_TZ = "America/Los_Angeles";

const dateFmt = new Map<string, Intl.DateTimeFormat>();
const partsFmt = new Map<string, Intl.DateTimeFormat>();

/** "YYYY-MM-DD" for an instant, in the park's time zone. */
export function parkDate(at: string | Date, tz = PARK_TZ): string {
  if (!dateFmt.has(tz)) dateFmt.set(tz, new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  return dateFmt.get(tz)!.format(typeof at === "string" ? new Date(at) : at);
}

/** Weekday (0 = Sunday) and hour (0–23) in the park's time zone. */
export function parkWeekdayHour(at: string, tz = PARK_TZ): { weekday: number; hour: number } {
  if (!partsFmt.has(tz)) partsFmt.set(tz, new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23" }));
  const parts = partsFmt.get(tz)!.formatToParts(new Date(at));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd), hour };
}

/** Adds days to a "YYYY-MM-DD" date. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86400000);
}

const counted = (status: string) => status !== "pending" && status !== "cancelled";

function tickets(orders: Order[], from: string, to: string, stallId: string | null, tz: string) {
  const out: { order: Order; so: Order["stall_orders"][number]; day: string }[] = [];
  for (const order of orders) {
    for (const so of order.stall_orders) {
      if (!counted(so.status)) continue;
      if (stallId && so.stall_id !== stallId) continue;
      const day = parkDate(so.created_at, tz);
      if (day < from || day > to) continue;
      out.push({ order, so, day });
    }
  }
  return out;
}

export function computeSalesRows(orders: Order[], from: string, to: string, stallId: string | null, tz = PARK_TZ): SalesRow[] {
  const map = new Map<string, SalesRow>();
  for (const { order, so, day } of tickets(orders, from, to, stallId, tz)) {
    const key = `${day}|${so.stall_id}`;
    const row =
      map.get(key) ??
      ({ day, stall_id: so.stall_id, orders: 0, items: 0, item_cents: 0, discount_cents: 0, tax_cents: 0, charged_cents: 0, online_cents: 0, at_stall_cents: 0, refunded_cents: 0 } satisfies SalesRow);
    const charged = so.subtotal_cents - (so.discount_cents ?? 0) + (so.tax_cents ?? 0);
    row.orders += 1;
    row.items += so.order_items.reduce((n, i) => n + i.qty, 0);
    row.item_cents += so.subtotal_cents;
    row.discount_cents += so.discount_cents ?? 0;
    row.tax_cents += so.tax_cents ?? 0;
    row.charged_cents += charged;
    if (order.payment_method === "online") row.online_cents += charged;
    else row.at_stall_cents += charged;
    row.refunded_cents += so.refunded_cents ?? 0;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => (a.day === b.day ? a.stall_id.localeCompare(b.stall_id) : a.day.localeCompare(b.day)));
}

export function computeItemRows(orders: Order[], from: string, to: string, stallId: string | null, tz = PARK_TZ): ItemSalesRow[] {
  const map = new Map<string, ItemSalesRow>();
  for (const { so } of tickets(orders, from, to, stallId, tz)) {
    for (const item of so.order_items) {
      const key = `${so.stall_id}|${item.menu_item_id}|${item.name}`;
      const row = map.get(key) ?? { stall_id: so.stall_id, menu_item_id: item.menu_item_id, name: item.name, qty: 0, sales_cents: 0 };
      row.qty += item.qty;
      row.sales_cents += item.qty * item.unit_price_cents;
      map.set(key, row);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.sales_cents - a.sales_cents);
}

export function computeHourRows(orders: Order[], from: string, to: string, stallId: string | null, tz = PARK_TZ): HourRow[] {
  const seen = new Map<string, Set<string>>();
  for (const { order, so } of tickets(orders, from, to, stallId, tz)) {
    const { weekday, hour } = parkWeekdayHour(so.created_at, tz);
    const key = `${weekday}|${hour}`;
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key)!.add(order.id);
  }
  return [...seen.entries()]
    .map(([key, ids]) => {
      const [weekday, hour] = key.split("|").map(Number);
      return { weekday, hour, orders: ids.size };
    })
    .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
}

// ---------------------------------------------------------------- summaries for the Reports tab

export interface SalesTotals {
  tickets: number;
  items: number;
  item_cents: number;
  discount_cents: number;
  tax_cents: number;
  charged_cents: number;
  online_cents: number;
  at_stall_cents: number;
  refunded_cents: number;
}

export function totalsOf(rows: SalesRow[]): SalesTotals {
  return rows.reduce<SalesTotals>(
    (t, r) => ({
      tickets: t.tickets + r.orders,
      items: t.items + r.items,
      item_cents: t.item_cents + r.item_cents,
      discount_cents: t.discount_cents + r.discount_cents,
      tax_cents: t.tax_cents + r.tax_cents,
      charged_cents: t.charged_cents + r.charged_cents,
      online_cents: t.online_cents + r.online_cents,
      at_stall_cents: t.at_stall_cents + r.at_stall_cents,
      refunded_cents: t.refunded_cents + r.refunded_cents,
    }),
    { tickets: 0, items: 0, item_cents: 0, discount_cents: 0, tax_cents: 0, charged_cents: 0, online_cents: 0, at_stall_cents: 0, refunded_cents: 0 },
  );
}

/** Groups sales rows by a key (day or stall) and totals each group. */
export function groupTotals(rows: SalesRow[], key: "day" | "stall_id"): [string, SalesTotals][] {
  const groups = new Map<string, SalesRow[]>();
  for (const r of rows) groups.set(r[key], [...(groups.get(r[key]) ?? []), r]);
  return [...groups.entries()].map(([k, rs]) => [k, totalsOf(rs)]);
}

// ---------------------------------------------------------------- CSV

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote when needed, and defuse spreadsheet formulas in text cells.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const dollars = (cents: number) => (cents / 100).toFixed(2);

export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function salesCsv(rows: SalesRow[], stallName: (id: string) => string): string {
  return toCsv(
    ["Date", "Truck", "Tickets", "Items", "Item sales", "Coupon discount", "Tax", "Charged", "Paid online", "Paid at truck", "Refunded"],
    rows.map((r) => [
      r.day,
      stallName(r.stall_id),
      r.orders,
      r.items,
      dollars(r.item_cents),
      dollars(r.discount_cents),
      dollars(r.tax_cents),
      dollars(r.charged_cents),
      dollars(r.online_cents),
      dollars(r.at_stall_cents),
      dollars(r.refunded_cents),
    ]),
  );
}

export function itemsCsv(rows: ItemSalesRow[], stallName: (id: string) => string): string {
  return toCsv(
    ["Truck", "Dish", "Quantity", "Sales"],
    rows.map((r) => [stallName(r.stall_id), r.name, r.qty, dollars(r.sales_cents)]),
  );
}

/** Starts a download of text as a file in the browser. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
