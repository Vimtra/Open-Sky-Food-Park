"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { backend } from "@/lib/backend";
import { friendlyError, money, plural } from "@/lib/format";
import type { CatalogIndex } from "@/lib/hooks";
import { addDays, daysBetween, downloadText, groupTotals, itemsCsv, parkDate, salesCsv, totalsOf } from "@/lib/reports";
import type { HourRow, SalesRow } from "@/lib/types";
import { Button, Chip, cn, inputClass, Notice, Spinner } from "./ui";

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
const presets: [Preset, string][] = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["month", "This month"],
  ["custom", "Pick dates"],
];

function rangeFor(p: Preset, today: string): [string, string] {
  switch (p) {
    case "yesterday":
      return [addDays(today, -1), addDays(today, -1)];
    case "7d":
      return [addDays(today, -6), today];
    case "30d":
      return [addDays(today, -29), today];
    case "month":
      return [`${today.slice(0, 8)}01`, today];
    default:
      return [today, today];
  }
}

const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

export function ReportsTab({ index }: { index: CatalogIndex }) {
  const today = parkDate(new Date(), index.catalog.park.timezone);
  const [preset, setPreset] = useState<Preset>("7d");
  const [custom, setCustom] = useState<[string, string]>([addDays(today, -6), today]);
  const [stallId, setStallId] = useState<string>("");
  const [from, to] = preset === "custom" ? custom : rangeFor(preset, today);
  const rangeOk = from <= to && daysBetween(from, to) <= 366;
  const stall = stallId || null;

  const key = rangeOk ? ["reports", from, to, stall] : null;
  const { data, error, isLoading } = useSWR(
    key,
    async () => {
      const b = backend();
      const [sales, items, hours] = await Promise.all([b.reportSales(from, to, stall), b.reportItems(from, to, stall), b.reportHours(from, to, stall)]);
      return { sales, items, hours };
    },
    { keepPreviousData: true },
  );

  const stallName = (id: string) => index.stallById.get(id)?.name ?? id;
  const fileTag = `${from}_to_${to}${stall ? `_${stall}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Filters: one row above everything they control */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
          {presets.map(([p, label]) => (
            <Chip key={p} selected={preset === p} onClick={() => setPreset(p)}>
              {label}
            </Chip>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-end gap-2">
            <label className="text-small font-bold text-ink-700">
              From
              <input type="date" className={cn(inputClass, "mt-1 h-10")} value={custom[0]} max={today} onChange={(e) => setCustom([e.target.value, custom[1]])} />
            </label>
            <label className="text-small font-bold text-ink-700">
              To
              <input type="date" className={cn(inputClass, "mt-1 h-10")} value={custom[1]} max={today} onChange={(e) => setCustom([custom[0], e.target.value])} />
            </label>
          </div>
        )}
        <label className="text-small font-bold text-ink-700">
          Truck
          <select className={cn(inputClass, "mt-1 h-10 pr-8")} value={stallId} onChange={(e) => setStallId(e.target.value)}>
            <option value="">All trucks</option>
            {index.stalls.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!rangeOk && <Notice tone="warn">Pick a start date before the end date, up to one year apart.</Notice>}
      {error && <Notice tone="error">{friendlyError(error)}</Notice>}
      {isLoading && !data && <Spinner />}

      {data && (
        <>
          <Totals sales={data.sales} />

          {data.sales.length === 0 ? (
            <p className="text-ink-500">No orders reached the trucks in this range.</p>
          ) : (
            <>
              {daysBetween(from, to) >= 1 && <DailyChart sales={data.sales} from={from} to={to} />}

              <section aria-labelledby="by-truck">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="by-truck" className="text-subheading font-extrabold">
                    By truck
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => downloadText(`open-sky-sales_${fileTag}.csv`, salesCsv(data.sales, stallName))}>
                    <Download className="size-4" aria-hidden /> Sales CSV (by day and truck)
                  </Button>
                </div>
                <TruckTable sales={data.sales} stallName={stallName} />
              </section>

              <section aria-labelledby="best-sellers">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="best-sellers" className="text-subheading font-extrabold">
                    Best sellers
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => downloadText(`open-sky-dishes_${fileTag}.csv`, itemsCsv(data.items, stallName))}>
                    <Download className="size-4" aria-hidden /> Dishes CSV
                  </Button>
                </div>
                <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[520px] text-left text-label">
                    <thead className="bg-surface-1 text-ink-700">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">Dish</th>
                        {!stall && <th className="px-4 py-2.5 font-bold">Truck</th>}
                        <th className="px-4 py-2.5 text-right font-bold">Sold</th>
                        <th className="px-4 py-2.5 text-right font-bold">Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-medium">
                      {data.items.slice(0, 10).map((r) => (
                        <tr key={`${r.stall_id}|${r.menu_item_id}|${r.name}`}>
                          <td className="px-4 py-2.5">{r.name}</td>
                          {!stall && <td className="px-4 py-2.5 text-ink-700">{stallName(r.stall_id)}</td>}
                          <td className="px-4 py-2.5 text-right tabular-nums">{r.qty}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{money(r.sales_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.items.length > 10 && <p className="mt-2 text-small text-ink-500">Top 10 of {data.items.length}. The CSV has them all.</p>}
              </section>

              <HoursHeatmap hours={data.hours} />
            </>
          )}
          <p className="text-small text-ink-500">
            Counts every truck ticket that reached the truck (not cancelled, not waiting for payment), by the park&apos;s local date. An order from two trucks
            is two tickets. &quot;Charged&quot; is item sales minus coupon discounts plus tax, what the trucks collect; service fees and tips are not included.
          </p>
        </>
      )}
    </div>
  );
}

function Totals({ sales }: { sales: SalesRow[] }) {
  const t = totalsOf(sales);
  const tiles: [string, string, string?][] = [
    ["Charged", money(t.charged_cents), `${money(t.item_cents)} items + ${money(t.tax_cents)} tax − ${money(t.discount_cents)} coupons`],
    ["Tickets", String(t.tickets), plural(t.items, "dish", "dishes")],
    ["Average ticket", t.tickets ? money(Math.round(t.charged_cents / t.tickets)) : "—"],
    ["Paid online", money(t.online_cents), `${money(t.at_stall_cents)} paid at the trucks`],
    ["Coupon discounts", money(t.discount_cents)],
    ["Refunded", money(t.refunded_cents)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map(([label, value, hint]) => (
        <div key={label} className="rounded-lg border border-line bg-white p-4">
          <dt className="text-small font-bold text-ink-500">{label}</dt>
          <dd className="mt-1 text-heading font-extrabold tabular-nums">{value}</dd>
          {hint && <dd className="mt-1 text-small text-ink-500">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Charged per day, one column per day. Single series: no legend; hover or the table give exact values. */
function DailyChart({ sales, from, to }: { sales: SalesRow[]; from: string; to: string }) {
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const days = useMemo(() => {
    const byDay = new Map(groupTotals(sales, "day"));
    const out: { day: string; cents: number; tickets: number }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ day: d, cents: byDay.get(d)?.charged_cents ?? 0, tickets: byDay.get(d)?.tickets ?? 0 });
    return out;
  }, [sales, from, to]);
  const max = Math.max(...days.map((d) => d.cents), 1);
  // clean tick step in whole dollars
  const rough = max / 100 / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= rough) ?? 10) * mag * 100;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(days.length / 10);
  const peak = days.reduce((a, d, i) => (d.cents > days[a].cents ? i : a), 0);

  return (
    <section aria-labelledby="daily">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="daily" className="text-subheading font-extrabold">
          Charged per day
        </h3>
        <button type="button" className="text-label font-bold text-ember-700 underline" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      {asTable ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-label">
            <thead className="bg-surface-1 text-ink-700">
              <tr>
                <th className="px-4 py-2 font-bold">Day</th>
                <th className="px-4 py-2 text-right font-bold">Tickets</th>
                <th className="px-4 py-2 text-right font-bold">Charged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {days.map((d) => (
                <tr key={d.day}>
                  <td className="px-4 py-2">{shortDay(d.day)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.tickets}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(d.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-line bg-white p-4">
          <div className="relative flex h-56 gap-3">
            {/* y axis */}
            <div className="relative w-12 shrink-0 text-right text-small text-ink-500 tabular-nums" aria-hidden>
              {ticks.map((t) => (
                <span key={t} className="absolute right-0" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
                  {money(t).replace(/\.00$/, "")}
                </span>
              ))}
            </div>
            <div className="relative flex-1">
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden />
              ))}
              <ul className="absolute inset-0 flex items-end gap-[2px]" aria-label="Charged per day">
                {days.map((d, i) => (
                  <li
                    key={d.day}
                    className="relative flex h-full flex-1 items-end justify-center"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${shortDay(d.day)}: ${money(d.cents)}, ${plural(d.tickets, "ticket")}`}
                  >
                    <span
                      className={cn("block w-full max-w-6 rounded-t-[4px] transition-colors", hover === i ? "bg-ember-700" : "bg-ember-500")}
                      style={{ height: d.cents ? `max(2px, ${(d.cents / top) * 100}%)` : 0 }}
                    />
                    {i === peak && d.cents > 0 && days.length <= 31 && hover === null && (
                      <span className="absolute -translate-y-1 text-small font-bold text-ink-900 tabular-nums" style={{ bottom: `${(d.cents / top) * 100}%` }}>
                        {money(d.cents).replace(/\.00$/, "")}
                      </span>
                    )}
                    {hover === i && (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute z-10 -translate-y-2 rounded-md bg-night-900 px-2.5 py-1.5 text-small whitespace-nowrap text-white shadow-lg"
                        style={{ bottom: `${(d.cents / top) * 100}%` }}
                      >
                        <strong className="block">{shortDay(d.day)}</strong>
                        <span className="tabular-nums">
                          {money(d.cents)} · {plural(d.tickets, "ticket")}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-2 ml-15 flex gap-[2px] text-small text-ink-500" aria-hidden>
            {days.map((d, i) => (
              <span key={d.day} className="flex-1 truncate text-center">
                {i % labelEvery === 0 ? shortDay(d.day) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TruckTable({ sales, stallName }: { sales: SalesRow[]; stallName: (id: string) => string }) {
  const rows = groupTotals(sales, "stall_id").sort((a, b) => b[1].charged_cents - a[1].charged_cents);
  const total = totalsOf(sales);
  const cols: [string, (t: ReturnType<typeof totalsOf>) => string][] = [
    ["Tickets", (t) => String(t.tickets)],
    ["Item sales", (t) => money(t.item_cents)],
    ["Coupons", (t) => (t.discount_cents ? `−${money(t.discount_cents)}` : money(0))],
    ["Tax", (t) => money(t.tax_cents)],
    ["Charged", (t) => money(t.charged_cents)],
    ["Online", (t) => money(t.online_cents)],
    ["At truck", (t) => money(t.at_stall_cents)],
    ["Refunded", (t) => money(t.refunded_cents)],
  ];
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[820px] text-left text-label">
        <thead className="bg-surface-1 text-ink-700">
          <tr>
            <th className="px-4 py-2.5 font-bold">Truck</th>
            {cols.map(([h]) => (
              <th key={h} className="px-4 py-2.5 text-right font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line font-medium">
          {rows.map(([id, t]) => (
            <tr key={id}>
              <td className="px-4 py-2.5">{stallName(id)}</td>
              {cols.map(([h, f]) => (
                <td key={h} className={cn("px-4 py-2.5 text-right tabular-nums", h === "Charged" && "font-extrabold")}>
                  {f(t)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length > 1 && (
            <tr className="bg-surface-1 font-extrabold">
              <td className="px-4 py-2.5">All trucks</td>
              {cols.map(([h, f]) => (
                <td key={h} className="px-4 py-2.5 text-right tabular-nums">
                  {f(total)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Orders by weekday and hour. Sequential ember ramp, light = few, dark = many; empty cells stay surface. */
const HEAT = ["bg-ember-100", "bg-ember-400", "bg-ember-500", "bg-ember-600", "bg-ember-700"];

function HoursHeatmap({ hours }: { hours: HourRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!hours.length) return null;
  const max = Math.max(...hours.map((h) => h.orders));
  const first = Math.min(...hours.map((h) => h.hour));
  const last = Math.max(...hours.map((h) => h.hour));
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const at = new Map(hours.map((h) => [`${h.weekday}|${h.hour}`, h.orders]));
  // the busiest hour always gets the darkest step
  const level = (n: number) => Math.min(HEAT.length - 1, Math.max(0, Math.ceil((n / Math.max(max, 1)) * HEAT.length) - 1));
  const busiest = hours.reduce((a, h) => (h.orders > a.orders ? h : a), hours[0]);

  return (
    <section aria-labelledby="hours">
      <h3 id="hours" className="text-subheading font-extrabold">
        Busiest hours
      </h3>
      <p className="mt-1 text-label text-ink-700">
        Busiest: {WEEKDAYS[busiest.weekday]} around {hourLabel(busiest.hour)}m, with {plural(busiest.orders, "order")}. Park local time.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white p-4">
        <table className="border-separate border-spacing-[2px] text-small">
          <thead>
            <tr>
              <th className="w-10" />
              {span.map((h) => (
                <th key={h} scope="col" className="min-w-9 font-semibold text-ink-500">
                  {hourLabel(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((w, wd) => (
              <tr key={w}>
                <th scope="row" className="pr-2 text-left font-semibold text-ink-500">
                  {w}
                </th>
                {span.map((h) => {
                  const n = at.get(`${wd}|${h}`) ?? 0;
                  const k = `${wd}|${h}`;
                  return (
                    <td
                      key={h}
                      className={cn("relative h-8 rounded-[4px]", n ? HEAT[level(n)] : "bg-surface-1")}
                      onMouseEnter={() => setHover(k)}
                      onMouseLeave={() => setHover(null)}
                      aria-label={`${w} ${hourLabel(h)}m: ${plural(n, "order")}`}
                    >
                      {hover === k && (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md bg-night-900 px-2 py-1 whitespace-nowrap text-white shadow-lg"
                        >
                          {w} {hourLabel(h)}m · {plural(n, "order")}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center gap-2 text-small text-ink-500" aria-hidden>
          Fewer
          {HEAT.map((c) => (
            <span key={c} className={cn("size-4 rounded-[4px]", c)} />
          ))}
          More
        </div>
      </div>
    </section>
  );
}
