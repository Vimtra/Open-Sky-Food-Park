"use client";

import { Pencil, Plus, TicketPercent } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { backend } from "@/lib/backend";
import { couponStatus, couponValueLabel, dayAndTime, money, plural } from "@/lib/format";
import type { CatalogIndex } from "@/lib/hooks";
import type { CouponKind, CouponWithUse } from "@/lib/types";
import { blankToNull, Check, ConfirmDelete, Select, Text, toCents, toDollars, type Run } from "./admin-kit";
import { Button, cn, Notice, Spinner } from "./ui";

/** "2026-11-20T18:00" for a datetime-local input, in the browser's time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const toWhole = (v: string) => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : NaN;
};

const statusTone: Record<ReturnType<typeof couponStatus>, string> = {
  Active: "bg-leaf-50 text-leaf-700",
  Scheduled: "bg-ember-50 text-ember-700",
  Expired: "bg-surface-2 text-ink-500",
  "Used up": "bg-surface-2 text-ink-500",
  Off: "bg-surface-2 text-ink-500",
};

function CouponForm({ coupon, index, run, onClose }: { coupon: CouponWithUse | null; index: CatalogIndex; run: Run; onClose: () => void }) {
  const [f, setF] = useState({
    code: coupon?.code ?? "",
    title: coupon?.title ?? "",
    description: coupon?.description ?? "",
    kind: (coupon?.kind ?? "percent") as CouponKind,
    value: coupon ? (coupon.kind === "percent" ? String(coupon.value) : toDollars(coupon.value)) : "",
    min: coupon?.min_order_cents ? toDollars(coupon.min_order_cents) : "",
    max: coupon?.max_discount_cents ? toDollars(coupon.max_discount_cents) : "",
    stall: coupon?.stall_id ?? "",
    starts: toLocalInput(coupon?.starts_at ?? null),
    ends: toLocalInput(coupon?.ends_at ?? null),
    usage: coupon?.usage_limit ? String(coupon.usage_limit) : "",
    perCustomer: coupon ? (coupon.per_customer_limit ? String(coupon.per_customer_limit) : "") : "1",
    active: coupon?.is_active ?? true,
    listed: coupon?.show_in_app ?? true,
  });
  const [touched, setTouched] = useState(false);
  const up = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const code = f.code.trim().toUpperCase();
  const pct = Number(f.value);
  const value = f.kind === "percent" ? (Number.isInteger(pct) && pct >= 1 && pct <= 100 ? pct : null) : toCents(f.value);
  const min = f.min.trim() ? toCents(f.min) : 0;
  const max = f.max.trim() ? toCents(f.max) : null;
  const usage = toWhole(f.usage);
  const perCustomer = toWhole(f.perCustomer);
  const datesOk = !f.starts || !f.ends || new Date(f.ends) > new Date(f.starts);
  const errors = {
    code: !/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(code) ? "3–24 letters or digits (- and _ allowed), e.g. WELCOME10." : null,
    title: !f.title.trim() ? "Give it a short name customers will see." : null,
    value: value === null || value <= 0 ? (f.kind === "percent" ? "Whole percent from 1 to 100." : "An amount like 2.00.") : null,
    min: min === null ? "An amount like 15.00, or leave empty." : null,
    max: f.max.trim() && (max === null || max <= 0) ? "An amount like 5.00, or leave empty." : null,
    usage: Number.isNaN(usage) ? "A whole number, or leave empty for no limit." : null,
    perCustomer: Number.isNaN(perCustomer) ? "A whole number, or leave empty for no limit." : null,
    dates: datesOk ? null : "The end must be after the start.",
  };
  const valid = Object.values(errors).every((e) => e === null);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    const ok = await run(
      () =>
        backend().saveCoupon({
          ...(coupon ? { id: coupon.id } : {}),
          code,
          title: f.title.trim(),
          description: blankToNull(f.description),
          kind: f.kind,
          value: value!,
          min_order_cents: min ?? 0,
          max_discount_cents: f.kind === "percent" ? max : null,
          stall_id: f.stall || null,
          starts_at: fromLocalInput(f.starts),
          ends_at: fromLocalInput(f.ends),
          usage_limit: usage as number | null,
          per_customer_limit: perCustomer as number | null,
          is_active: f.active,
          show_in_app: f.listed,
        }),
      coupon ? `Saved ${code}.` : `Coupon ${code} created.`,
    );
    if (ok) onClose();
  };
  const err = (k: keyof typeof errors) => (touched ? errors[k] : null);

  return (
    <div className="rounded-lg border border-night-900 bg-surface-1 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Code" value={f.code} onChange={(v) => up("code")(v.toUpperCase())} placeholder="WELCOME10" autoCapitalize="characters" error={err("code")} />
        <Text label="Name customers see" value={f.title} onChange={up("title")} placeholder="10% off your first order" error={err("title")} />
      </div>
      <div className="mt-4">
        <Text label="Details (optional)" value={f.description} onChange={up("description")} placeholder="e.g. Weeknights only, not with other offers" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Select label="Discount" value={f.kind} onChange={(v) => setF((s) => ({ ...s, kind: v as CouponKind, value: "" }))}>
          <option value="percent">Percent off</option>
          <option value="amount">Dollar amount off</option>
        </Select>
        <Text
          label={f.kind === "percent" ? "Percent" : "Amount (USD)"}
          value={f.value}
          onChange={up("value")}
          inputMode="decimal"
          placeholder={f.kind === "percent" ? "10" : "2.00"}
          error={err("value")}
        />
        {f.kind === "percent" ? (
          <Text label="Cap (USD, optional)" value={f.max} onChange={up("max")} inputMode="decimal" placeholder="5.00" hint="Most it can take off." error={err("max")} />
        ) : (
          <span className="hidden sm:block" />
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Text label="Minimum order (USD)" value={f.min} onChange={up("min")} inputMode="decimal" placeholder="0.00" hint="Of the dishes the coupon covers." error={err("min")} />
        <Select label="Works on" value={f.stall} onChange={up("stall")}>
          <option value="">Every truck</option>
          {index.catalog.stalls.map((s) => (
            <option key={s.id} value={s.id}>
              Only {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Text label="Starts (optional)" type="datetime-local" value={f.starts} onChange={up("starts")} />
        <Text label="Ends (optional)" type="datetime-local" value={f.ends} onChange={up("ends")} error={err("dates")} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Text label="Total uses (optional)" value={f.usage} onChange={up("usage")} inputMode="numeric" placeholder="No limit" hint="Across all customers." error={err("usage")} />
        <Text label="Uses per customer" value={f.perCustomer} onChange={up("perCustomer")} inputMode="numeric" placeholder="No limit" error={err("perCustomer")} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <Check label="Switched on" checked={f.active} onChange={(v) => setF((s) => ({ ...s, active: v }))} />
        <Check label="List it under Offers at checkout" checked={f.listed} onChange={(v) => setF((s) => ({ ...s, listed: v }))} />
      </div>
      {!f.listed && <p className="text-small text-ink-500">Hidden coupons work only when the customer types the code.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={save}>{coupon ? "Save coupon" : "Create coupon"}</Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {coupon && (
          <span className="ml-auto">
            <ConfirmDelete what="coupon" onDelete={() => void run(() => backend().deleteCoupon(coupon.id), `Deleted ${coupon.code}.`).then((ok) => ok && onClose())} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Admin → Coupons: every code with its rules, status and how often it has been used. */
export function CouponsTab({ index, run, couponsOn }: { index: CatalogIndex; run: Run; couponsOn: boolean }) {
  const { data, error, mutate } = useSWR("coupons:all", () => backend().listCoupons(), { refreshInterval: 60_000 });
  const [editing, setEditing] = useState<string | null>(null);
  const runAndRefresh: Run = async (fn, done) => {
    const ok = await run(fn, done);
    await mutate();
    return ok;
  };

  if (error && !data) return <Notice tone="error">Could not load coupons.</Notice>;
  if (!data) return <Spinner />;

  return (
    <>
      <p className="max-w-prose text-ink-700">
        Customers enter a code in the cart, or pick one listed under Offers. The discount comes off the dishes before tax, and each truck&apos;s
        share shows on its tickets.
      </p>
      {!couponsOn && (
        <Notice tone="warn" className="mt-4">
          Coupons are switched off for the whole park (Settings), so customers can&apos;t use any of these right now.
        </Notice>
      )}

      <ul className="mt-5 space-y-3">
        {data.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <CouponForm coupon={c} index={index} run={runAndRefresh} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ember-50 text-ember-700">
                <TicketPercent className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xs border border-dashed border-line-strong px-1.5 py-0.5 font-mono text-label font-bold tracking-wide">{c.code}</span>
                  <span className="font-bold">{c.title}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-caption font-bold", statusTone[couponStatus(c)])}>{couponStatus(c)}</span>
                  {!c.show_in_app && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-caption font-bold text-ink-700">Hidden</span>}
                </span>
                <span className="mt-1 block text-small text-ink-500">
                  {couponValueLabel(c)}
                  {c.min_order_cents > 0 && ` · min ${money(c.min_order_cents)}`}
                  {c.stall_id && ` · only ${index.stallById.get(c.stall_id)?.name ?? c.stall_id}`}
                  {c.ends_at && ` · ends ${dayAndTime(c.ends_at)}`}
                  {` · used ${plural(c.used, "time")}${c.usage_limit ? ` of ${c.usage_limit}` : ""}`}
                  {c.per_customer_limit ? ` · ${c.per_customer_limit} per customer` : ""}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditing(c.id)} aria-label={`Edit ${c.code}`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            </li>
          ),
        )}
      </ul>
      {data.length === 0 && editing !== "new" && <p className="mt-2 text-ink-500">No coupons yet.</p>}

      <div className="mt-5">
        {editing === "new" ? (
          <CouponForm coupon={null} index={index} run={runAndRefresh} onClose={() => setEditing(null)} />
        ) : (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus className="size-4" strokeWidth={2.5} aria-hidden />
            New coupon
          </Button>
        )}
      </div>
    </>
  );
}
