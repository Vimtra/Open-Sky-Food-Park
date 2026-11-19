"use client";

// "Today" for the stall dashboard (ROADMAP S3): the truck's own numbers and order history for today.
// Built from the same live ticket list as the board (useStallTickets), which covers the last 24 hours,
// so it needs no new data calls. Everything shown is counted from real orders; nothing is estimated.

import { Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { money, plural, timeOfDay } from "@/lib/format";
import { useStallTickets } from "@/lib/hooks";
import type { StallTicket } from "@/lib/types";
import { printTicket, ticketDue } from "./partner-print";
import { cn, DietMark, Notice, Spinner } from "./ui";

type Filter = "all" | "open" | "done" | "cancelled";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "In progress" },
  { key: "done", label: "Handed over" },
  { key: "cancelled", label: "Cancelled" },
];

const statusLabel: Record<string, string> = {
  placed: "New",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Handed over",
  cancelled: "Cancelled",
};

/** Same calendar day on this device's clock (the dashboard runs at the truck). */
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

export function TodayPanel({ stallId, stallName }: { stallId: string; stallName: string }) {
  const { tickets, error } = useStallTickets(stallId);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const today = useMemo(() => (tickets ?? []).filter((t) => isToday(t.placed_at ?? t.created_at)), [tickets]);

  const stats = useMemo(() => {
    const live = today.filter((t) => t.status !== "cancelled");
    const done = today.filter((t) => t.status === "completed");
    const sales = live.reduce((n, t) => n + t.subtotal_cents - (t.discount_cents ?? 0), 0);
    const tax = live.reduce((n, t) => n + (t.tax_cents ?? 0), 0);
    const discount = live.reduce((n, t) => n + (t.discount_cents ?? 0), 0);
    const byDish = new Map<string, { name: string; diet: StallTicket["order_items"][number]["diet"]; qty: number; cents: number }>();
    for (const t of live) {
      for (const i of t.order_items) {
        const key = i.menu_item_id ?? i.name;
        const row = byDish.get(key) ?? { name: i.name, diet: i.diet, qty: 0, cents: 0 };
        row.qty += i.qty;
        row.cents += i.unit_price_cents * i.qty;
        byDish.set(key, row);
      }
    }
    const top = [...byDish.values()].sort((a, b) => b.qty - a.qty || b.cents - a.cents).slice(0, 5);
    const collectedAtTruck = live
      .filter((t) => t.order.payment_method === "pay_at_stall")
      .reduce((n, t) => n + ticketDue(t), 0);
    return {
      orders: live.length,
      done: done.length,
      cancelled: today.length - live.length,
      sales,
      tax,
      discount,
      average: live.length ? Math.round(sales / live.length) : 0,
      top,
      collectedAtTruck,
    };
  }, [today]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return today
      .filter((t) =>
        filter === "all"
          ? true
          : filter === "open"
            ? ["placed", "preparing", "ready"].includes(t.status)
            : filter === "done"
              ? t.status === "completed"
              : t.status === "cancelled",
      )
      .filter(
        (t) =>
          !q ||
          String(t.token_no) === q.replace(/^#/, "") ||
          t.order.customer_name.toLowerCase().includes(q) ||
          t.order.order_no.toLowerCase().includes(q) ||
          t.order_items.some((i) => i.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.placed_at ?? b.created_at).localeCompare(a.placed_at ?? a.created_at));
  }, [today, filter, query]);

  if (error && !tickets) return <Notice tone="error">Could not load today&apos;s orders. Check the connection; this screen retries on its own.</Notice>;
  if (!tickets)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-6">
      <section aria-label="Today's numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={String(stats.orders)} hint={`${stats.done} handed over${stats.cancelled ? ` · ${stats.cancelled} cancelled` : ""}`} />
        <Stat label="Sales" value={money(stats.sales)} hint={stats.discount ? `after ${money(stats.discount)} in coupons` : "before tax"} />
        <Stat label="Average order" value={stats.orders ? money(stats.average) : "–"} hint="sales ÷ orders" />
        <Stat label="Tax" value={money(stats.tax)} hint={stats.collectedAtTruck ? `${money(stats.collectedAtTruck)} to collect at the truck` : "on today's orders"} />
      </section>

      <section aria-labelledby="top-dishes" className="rounded-xl bg-surface-1 p-4">
        <h2 id="top-dishes" className="text-subheading font-extrabold">
          Top dishes today
        </h2>
        {stats.top.length === 0 ? (
          <p className="mt-2 text-label font-medium text-ink-500">No orders yet today.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {stats.top.map((d, i) => {
              const max = stats.top[0].qty;
              return (
                <li key={d.name} className="flex items-center gap-3 text-label font-semibold">
                  <span className="w-5 text-right font-extrabold tabular-nums text-ink-500">{i + 1}</span>
                  <DietMark diet={d.diet} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.name}</span>
                    <span className="mt-1 block h-1.5 rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-ember-500" style={{ width: `${Math.max(6, (d.qty / max) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="w-12 text-right font-extrabold tabular-nums">{d.qty}×</span>
                  <span className="w-20 text-right tabular-nums text-ink-700">{money(d.cents)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="history" className="rounded-xl border border-line">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <h2 id="history" className="mr-auto px-1 text-subheading font-extrabold">
            Today&apos;s orders <span className="text-label font-semibold text-ink-500 tabular-nums">{plural(today.length, "order")}</span>
          </h2>
          <label className="relative">
            <span className="sr-only">Search today&apos;s orders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Token, name, dish or OS-…"
              className="h-10 w-60 rounded-md border border-line bg-white pr-3 pl-9 text-label font-medium hover:border-line-strong focus:border-ember-600 focus:ring-2 focus:ring-ember-100 focus:outline-none"
            />
          </label>
          <div className="flex gap-1.5" role="tablist" aria-label="Show">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-9 rounded-full px-3 text-label font-bold transition-colors duration-150",
                  filter === f.key ? "bg-night-900 text-white" : "bg-surface-2 text-ink-700 hover:bg-surface-1",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <p className="p-4 text-label font-medium text-ink-500">{today.length === 0 ? "No orders yet today." : "No orders match."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-label font-medium">
                <span className="w-12 text-[1.0625rem] font-extrabold tabular-nums">#{t.token_no}</span>
                <span className="w-16 tabular-nums text-ink-700">{timeOfDay(t.placed_at ?? t.created_at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{t.order.customer_name}</span>
                  <span className="block truncate text-small text-ink-500">
                    {t.order_items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-caption font-bold",
                    t.status === "cancelled" ? "bg-chili-50 text-chili-600" : t.status === "completed" ? "bg-surface-2 text-ink-700" : "bg-ember-100 text-ember-700",
                  )}
                >
                  {statusLabel[t.status] ?? t.status}
                </span>
                <span className="w-20 text-right font-bold tabular-nums">{money(ticketDue(t))}</span>
                <button
                  type="button"
                  onClick={() => printTicket(t, stallName)}
                  aria-label={`Print token ${t.token_no}`}
                  className="hit-44 relative rounded-full p-2 text-ink-700 hover:bg-surface-1"
                >
                  <Printer className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-small text-ink-500">Counts today&apos;s orders on this device&apos;s clock. Sales are dishes after coupons, before tax; cancelled orders are left out.</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-small font-semibold text-ink-500">{label}</p>
      <p className="mt-1 text-title tabular-nums">{value}</p>
      <p className="mt-0.5 text-small text-ink-500">{hint}</p>
    </div>
  );
}
