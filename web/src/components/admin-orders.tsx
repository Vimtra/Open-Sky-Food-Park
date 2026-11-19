"use client";

import { Phone, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { backend } from "@/lib/backend";
import type { OrderSearch } from "@/lib/backend/types";
import { dayAndTime, friendlyError, isOrderLive, money, plural, timeOfDay } from "@/lib/format";
import type { CatalogIndex } from "@/lib/hooks";
import { addDays, parkDate } from "@/lib/reports";
import type { Order, OrderStatus, Refund } from "@/lib/types";
import type { Run } from "./admin-kit";
import { StatusPill } from "./order-screen";
import { Button, cn, inputClass, Notice, Spinner } from "./ui";

const statusText: Record<OrderStatus, string> = {
  awaiting_payment: "Waiting for payment",
  active: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const charged = (so: Order["stall_orders"][number]) => so.subtotal_cents - (so.discount_cents ?? 0) + (so.tax_cents ?? 0);

function paymentText(o: Order) {
  if (o.payment_status === "refunded") return "Refunded";
  if ((o.refunded_cents ?? 0) > 0) return `Paid online · ${money(o.refunded_cents ?? 0)} refunded`;
  if (o.payment_status === "paid") return "Paid online";
  return o.payment_method === "online" ? "Awaiting payment" : "At the truck";
}

/** Waits until typing pauses before searching. */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function OrdersTab({ index, run }: { index: CatalogIndex; run: Run }) {
  const today = parkDate(new Date(), index.catalog.park.timezone);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<OrderSearch["status"]>("all");
  const [stallId, setStallId] = useState("");
  const [payment, setPayment] = useState<NonNullable<OrderSearch["payment"]>>("all");
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(text);

  const filter: OrderSearch = { text: q, status, stall_id: stallId || null, payment, from: from || null, to: to || null };
  const key = ["orders:search", JSON.stringify(filter)];
  const { data: orders, error, mutate } = useSWR(key, () => backend().searchOrders(filter), { keepPreviousData: true, refreshInterval: 30_000 });
  const { data: refunds, mutate: mutateRefunds } = useSWR("refunds:all", () => backend().listRefunds(), { refreshInterval: 60_000 });

  useEffect(
    () =>
      backend().onOrdersChange(() => {
        void mutate();
        void mutateRefunds();
      }),
    [mutate, mutateRefunds],
  );

  const pending = (refunds ?? []).filter((r) => r.status === "pending");
  const failed = (refunds ?? []).filter((r) => r.status === "failed");
  const open = orders?.find((o) => o.id === openId) ?? null;
  const filtered = Boolean(q || status !== "all" || stallId || payment !== "all");

  const sendPending = () =>
    run(async () => {
      const r = await backend().processRefunds();
      await Promise.all([mutate(), mutateRefunds()]);
      if (r.failed) throw new Error(`${plural(r.sent, "refund")} sent, ${r.failed} failed. Open the order to see why.`);
    }, "Refunds sent.");

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Notice tone="warn">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <strong>{plural(pending.length, "refund")}</strong> worth {money(pending.reduce((n, r) => n + r.amount_cents, 0))} waiting to be sent (a truck
              rejected, or a customer cancelled, an order that was paid online).
            </span>
            <Button size="sm" onClick={sendPending}>
              Send refunds now
            </Button>
          </span>
        </Notice>
      )}
      {failed.length > 0 && (
        <Notice tone="error">
          {plural(failed.length, "refund")} failed at Stripe. Open the order to see why, then refund it again or contact the customer.
        </Notice>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-60 flex-1 text-small font-bold text-ink-700">
          Search
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              className={cn(inputClass, "h-10 pl-9")}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Order number, name, phone or #token"
              type="search"
            />
          </span>
        </label>
        <label className="text-small font-bold text-ink-700">
          Status
          <select className={cn(inputClass, "mt-1 h-10 pr-8")} value={status} onChange={(e) => setStatus(e.target.value as OrderSearch["status"])}>
            <option value="all">All</option>
            {(Object.keys(statusText) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {statusText[s]}
              </option>
            ))}
          </select>
        </label>
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
        <label className="text-small font-bold text-ink-700">
          Payment
          <select className={cn(inputClass, "mt-1 h-10 pr-8")} value={payment} onChange={(e) => setPayment(e.target.value as typeof payment)}>
            <option value="all">All</option>
            <option value="online">Paid online</option>
            <option value="pay_at_stall">At the truck</option>
            <option value="refunds">With a refund</option>
          </select>
        </label>
        <label className="text-small font-bold text-ink-700">
          From
          <input type="date" className={cn(inputClass, "mt-1 h-10")} value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-small font-bold text-ink-700">
          To
          <input type="date" className={cn(inputClass, "mt-1 h-10")} value={to} max={today} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {error && !orders && <Notice tone="error">{friendlyError(error)}</Notice>}
      {!orders && !error && <Spinner />}

      {orders && (
        <>
          <p className="text-label text-ink-700">
            {plural(orders.length, "order")}
            {orders.length === 500 && " (showing the newest 500; narrow the dates to see older ones)"} ·{" "}
            <strong className="text-ink-900 tabular-nums">{orders.filter(isOrderLive).length}</strong> in progress
          </p>
          {orders.length === 0 ? (
            <p className="py-6 text-ink-500">{filtered ? "No orders match. Try fewer filters or wider dates." : "No orders in these dates yet."}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[760px] text-left text-label">
                <thead className="bg-surface-1 text-ink-700">
                  <tr>
                    {["Order", "Placed", "Customer", "Trucks", "Payment", "Total"].map((h) => (
                      <th key={h} scope="col" className={cn("px-4 py-2.5 font-bold", h === "Total" && "text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium">
                  {orders.map((o) => (
                    <tr key={o.id} className="cursor-pointer align-top hover:bg-surface-1" onClick={() => setOpenId(o.id)}>
                      <td className="px-4 py-3">
                        <button type="button" className="font-bold text-ember-700 tabular-nums underline-offset-2 hover:underline" onClick={() => setOpenId(o.id)}>
                          {o.order_no}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-700 tabular-nums">
                        {dayAndTime(o.created_at)}
                        {o.pickup_at && <span className="block text-small font-bold text-ink-900">For {timeOfDay(o.pickup_at)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {o.customer_name}
                        <span className="block text-small text-ink-500">{o.fulfilment === "table" ? `Table ${o.table_no}` : "Pickup"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <ul className="space-y-1.5">
                          {o.stall_orders.map((s) => (
                            <li key={s.id} className="flex items-center gap-2">
                              <span className="tabular-nums">#{s.token_no}</span>
                              <span className="truncate">{s.stall?.name}</span>
                              <StatusPill status={s.status} />
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{paymentText(o)}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {money(o.total_cents)}
                        {o.coupon_code && (
                          <span className="block text-small font-medium text-leaf-700">
                            {o.coupon_code} −{money(o.discount_cents)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {open && (
        <OrderDetail
          order={open}
          refunds={(refunds ?? []).filter((r) => r.order_id === open.id)}
          run={run}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            void mutate();
            void mutateRefunds();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ one order
function OrderDetail({ order, refunds, run, onClose, onChanged }: { order: Order; refunds: Refund[]; run: Run; onClose: () => void; onChanged: () => void }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const refundable = order.payment_method === "online" && order.payment_status !== "unpaid";
  const committed = refunds.filter((r) => r.status !== "failed").reduce((n, r) => n + r.amount_cents, 0);
  const left = Math.max(order.total_cents - committed, 0);
  const cancellable = order.status !== "cancelled" && order.stall_orders.every((s) => ["pending", "placed", "cancelled"].includes(s.status));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cancel = async () => {
    const ok = await run(() => backend().cancelOrder(order.id), refundable ? "Order cancelled. Its refund is queued: send it from the banner above." : "Order cancelled.");
    if (ok) {
      setConfirmCancel(false);
      onChanged();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-night-950/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="order-detail-title" className="text-heading font-extrabold tabular-nums">
              {order.order_no}
            </h2>
            <p className="mt-1 text-label text-ink-700">
              {statusText[order.status]} · placed {dayAndTime(order.created_at)}
              {order.pickup_at && ` · for ${timeOfDay(order.pickup_at)}`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="hit-44 relative rounded-full p-2 text-ink-500 hover:bg-surface-1">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-label">
          <div>
            <dt className="text-small font-bold text-ink-500">Customer</dt>
            <dd className="font-semibold">{order.customer_name}</dd>
            {order.customer_phone && (
              <dd>
                <a className="inline-flex items-center gap-1 font-bold text-ember-700 hover:underline" href={`tel:${order.customer_phone.replace(/[^\d+]/g, "")}`}>
                  <Phone className="size-3.5" aria-hidden /> {order.customer_phone}
                </a>
              </dd>
            )}
          </div>
          <div>
            <dt className="text-small font-bold text-ink-500">How</dt>
            <dd className="font-semibold">{order.fulfilment === "table" ? `Table ${order.table_no}` : "Pickup at the trucks"}</dd>
          </div>
          <div>
            <dt className="text-small font-bold text-ink-500">Payment</dt>
            <dd className="font-semibold">{paymentText(order)}</dd>
          </div>
          {order.note && (
            <div>
              <dt className="text-small font-bold text-ink-500">Note</dt>
              <dd className="font-semibold">{order.note}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 space-y-4">
          {order.stall_orders.map((so) => (
            <section key={so.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-night-900 px-2 py-0.5 text-label font-extrabold text-white tabular-nums">#{so.token_no}</span>
                <h3 className="font-extrabold">{so.stall?.name ?? so.stall_id}</h3>
                <StatusPill status={so.status} />
                {so.ready_by && so.status === "preparing" && <span className="text-small text-ink-500">ready by {timeOfDay(so.ready_by)}</span>}
              </div>
              <ul className="mt-3 space-y-2 text-label">
                {so.order_items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>
                      <strong className="tabular-nums">{i.qty}×</strong> {i.name}
                      {(i.options ?? []).length > 0 && (
                        <span className="block text-small text-ink-500">{(i.options ?? []).map((op) => (op.price_cents ? `${op.name} +${money(op.price_cents)}` : op.name)).join(", ")}</span>
                      )}
                      {i.note && <span className="block text-small text-ink-700">“{i.note}”</span>}
                    </span>
                    <span className="tabular-nums">{money(i.qty * i.unit_price_cents)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-2 text-small text-ink-700 tabular-nums">
                Truck charges {money(charged(so))}
                {(so.discount_cents ?? 0) > 0 && ` (coupon −${money(so.discount_cents)})`}
                {(so.tax_cents ?? 0) > 0 && ` incl. ${money(so.tax_cents)} tax`}
                {(so.refunded_cents ?? 0) > 0 && ` · ${money(so.refunded_cents ?? 0)} refunded`}
              </p>
            </section>
          ))}
        </div>

        <dl className="mt-5 space-y-1.5 rounded-lg bg-surface-1 p-4 text-label tabular-nums">
          <div className="flex justify-between">
            <dt>Item total</dt>
            <dd>{money(order.item_total_cents)}</dd>
          </div>
          {order.discount_cents > 0 && (
            <div className="flex justify-between text-leaf-700">
              <dt>Coupon {order.coupon_code}</dt>
              <dd>−{money(order.discount_cents)}</dd>
            </div>
          )}
          {order.tax_cents > 0 && (
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{money(order.tax_cents)}</dd>
            </div>
          )}
          {order.service_fee_cents > 0 && (
            <div className="flex justify-between">
              <dt>Service fee</dt>
              <dd>{money(order.service_fee_cents)}</dd>
            </div>
          )}
          {order.tip_cents > 0 && (
            <div className="flex justify-between">
              <dt>Tip</dt>
              <dd>{money(order.tip_cents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-1.5 font-extrabold">
            <dt>Total</dt>
            <dd>{money(order.total_cents)}</dd>
          </div>
        </dl>

        {refunds.length > 0 && (
          <section className="mt-5">
            <h3 className="font-extrabold">Refunds</h3>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-label">
              {refunds.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 p-3">
                  <span>
                    <strong className="tabular-nums">{money(r.amount_cents)}</strong> · {r.reason}
                    <span className="block text-small text-ink-500">
                      {dayAndTime(r.created_at)}
                      {r.stripe_refund_id && ` · ${r.stripe_refund_id}`}
                    </span>
                    {r.error && <span className="block text-small font-semibold text-chili-600">{r.error}</span>}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-caption font-bold",
                      r.status === "succeeded" ? "bg-leaf-50 text-leaf-700" : r.status === "failed" ? "bg-chili-50 text-chili-600" : "bg-ember-50 text-ember-700",
                    )}
                  >
                    {r.status === "succeeded" ? "Sent" : r.status === "failed" ? "Failed" : "Waiting"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {refundable && left > 0 && <RefundForm order={order} left={left} run={run} onDone={onChanged} />}
        {order.payment_method === "pay_at_stall" && (
          <p className="mt-5 text-small text-ink-500">Paid at the truck, so any money back is handed over by the truck, not refunded online.</p>
        )}

        {cancellable && (
          <div className="mt-6 border-t border-line pt-5">
            {confirmCancel ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-label font-semibold">Cancel the whole order{refundable ? " and queue a full refund" : ""}?</span>
                <Button variant="danger" size="sm" onClick={cancel}>
                  Yes, cancel it
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-chili-600" onClick={() => setConfirmCancel(true)}>
                Cancel order
              </Button>
            )}
            <p className="mt-2 text-small text-ink-500">Only possible before any truck starts cooking.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function RefundForm({ order, left, run, onDone }: { order: Order; left: number; run: Run; onDone: () => void }) {
  type Choice = "all" | "custom" | string; // string = a stall order id
  const parts = order.stall_orders.map((so) => ({ so, due: Math.min(charged(so) - (so.refunded_cents ?? 0), left) })).filter((p) => p.due > 0);
  const [choice, setChoice] = useState<Choice>("all");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const part = parts.find((p) => p.so.id === choice);
  const cents = choice === "all" ? left : part ? part.due : Math.round(Number(amount) * 100);
  const valid = Number.isFinite(cents) && cents > 0 && cents <= left && reason.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    const ok = await run(
      () => backend().requestRefund(order.id, part ? part.so.id : null, cents, reason.trim()),
      `Refund of ${money(cents)} sent.`,
    );
    if (ok) {
      setReason("");
      setAmount("");
      onDone();
    }
  };

  return (
    <section className="mt-5 rounded-lg border border-line p-4" aria-labelledby="refund-title">
      <h3 id="refund-title" className="font-extrabold">
        Refund
      </h3>
      <p className="mt-1 text-small text-ink-500">Goes back to the customer&apos;s card or wallet through Stripe. {money(left)} can still be refunded.</p>
      <fieldset className="mt-3 space-y-2 text-label">
        <legend className="sr-only">How much to refund</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="refund" checked={choice === "all"} onChange={() => setChoice("all")} /> Everything left ({money(left)})
        </label>
        {parts.length > 1 &&
          parts.map((p) => (
            <label key={p.so.id} className="flex items-center gap-2">
              <input type="radio" name="refund" checked={choice === p.so.id} onChange={() => setChoice(p.so.id)} /> Only {p.so.stall?.name ?? p.so.stall_id}&apos;s part (
              {money(p.due)})
            </label>
          ))}
        <label className="flex flex-wrap items-center gap-2">
          <input type="radio" name="refund" checked={choice === "custom"} onChange={() => setChoice("custom")} /> Another amount
          {choice === "custom" && (
            <span className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-500">$</span>
              <input
                className={cn(inputClass, "h-9 w-28 pl-6 tabular-nums")}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                aria-label="Refund amount in dollars"
                autoFocus
              />
            </span>
          )}
        </label>
      </fieldset>
      <label className="mt-3 block text-small font-bold text-ink-700">
        Reason (the customer may see it)
        <input className={cn(inputClass, "mt-1 h-10")} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Raita was missing" />
      </label>
      {choice === "custom" && amount && cents > left && <p className="mt-2 text-small font-semibold text-chili-600">That is more than the {money(left)} left.</p>}
      <Button className="mt-3" onClick={submit} disabled={!valid}>
        Refund {Number.isFinite(cents) && cents > 0 ? money(cents) : ""}
      </Button>
    </section>
  );
}
