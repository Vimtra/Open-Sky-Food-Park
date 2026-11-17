"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronLeft, CreditCard, Phone, Receipt } from "lucide-react";
import { useState } from "react";
import { backend, isDemo, type PaymentStart } from "@/lib/backend";
import { dayAndTime, friendlyError, imageSrc, money, ticketGuidance, ticketLabel } from "@/lib/format";
import { useOrder, useSession } from "@/lib/hooks";
import type { Order, StallOrder, TicketStatus } from "@/lib/types";
import { Button, ButtonLink, cn, Container, DietMark, EmptyState, Notice, Spinner } from "./ui";

const StripePay = dynamic(() => import("./stripe-pay").then((m) => m.StripePay), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-6">
      <Spinner />
    </div>
  ),
});

const pillClass: Record<TicketStatus, string> = {
  pending: "bg-surface-2 text-ink-700",
  placed: "bg-surface-2 text-ink-700",
  preparing: "bg-ember-100 text-ember-700",
  ready: "bg-leaf-600 text-white",
  completed: "bg-surface-2 text-ink-700",
  cancelled: "bg-chili-50 text-chili-600",
};

export function StatusPill({ status, className }: { status: TicketStatus; className?: string }) {
  return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-caption font-bold", pillClass[status], className)}>{ticketLabel[status]}</span>;
}

const steps: { key: TicketStatus; label: string }[] = [
  { key: "placed", label: "Sent" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
];
const reached: Record<TicketStatus, number> = { pending: 0, placed: 1, preparing: 2, ready: 3, completed: 3, cancelled: 0 };

function Progress({ status }: { status: TicketStatus }) {
  if (status === "cancelled" || status === "pending") return null;
  const done = reached[status];
  return (
    <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label={`Progress: ${ticketLabel[status]}`}>
      {steps.map((step, i) => (
        <li key={step.key}>
          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span
              className={cn("block size-full origin-left bg-leaf-600 transition-transform duration-500 ease-move", i < done ? "scale-x-100" : "scale-x-0")}
              style={{ transitionDelay: `${i * 120}ms` }}
            />
          </span>
          <span className={cn("mt-1.5 block text-caption", i < done ? "font-bold text-ink-900" : "font-medium text-ink-500")}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function TokenCard({ so, order }: { so: StallOrder; order: Order }) {
  const ready = so.status === "ready";
  const muted = so.status === "cancelled" || so.status === "completed";
  return (
    <article className={cn("rounded-xl border p-4 transition-colors duration-500 md:p-5", ready ? "border-leaf-600 bg-leaf-50" : "border-line bg-white")}>
      <div className="flex gap-4">
        <div
          key={so.status}
          className={cn(
            "animate-pop flex w-[5.5rem] shrink-0 flex-col items-center justify-center rounded-sm py-2.5 md:rounded-[4px]",
            ready ? "bg-leaf-600 text-white" : muted ? "bg-surface-2 text-ink-500" : "bg-night-900 text-white",
          )}
        >
          <span className={cn("text-caption font-semibold", ready || muted ? "opacity-90" : "text-night-muted")}>Token</span>
          <span className="text-token tabular-nums">{so.token_no}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-subheading font-extrabold">
              {so.stall?.logo_url && <img src={imageSrc(so.stall.logo_url)!} alt="" className="size-7 rounded-full border border-line bg-white object-cover" />}
              <span className="truncate">{so.stall?.name ?? "Stall"}</span>
            </h2>
            <StatusPill status={so.status} />
          </div>
          <p className={cn("mt-1.5 text-[0.9375rem] leading-5", ready ? "font-bold text-leaf-700" : "text-ink-700")} aria-live="polite">
            {ticketGuidance(so, order)}
          </p>
          {so.stall?.location_label && <p className="mt-1 text-small text-ink-500">{so.stall.location_label}</p>}
        </div>
      </div>

      <Progress status={so.status} />

      <ul className="mt-4 space-y-2 border-t border-line/70 pt-3">
        {so.order_items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-label font-medium text-ink-700">
            <span className="w-6 shrink-0 font-bold text-ink-900 tabular-nums">{item.qty}×</span>
            <DietMark diet={item.diet} className="mt-0.5" />
            <span className="min-w-0 flex-1">{item.name}</span>
            <span className="tabular-nums">{money(item.unit_price_cents * item.qty)}</span>
          </li>
        ))}
      </ul>

      {so.stall?.phone && !muted && (
        <a href={`tel:${so.stall.phone.replace(/[^\d+]/g, "")}`} className="mt-3 inline-flex h-9 items-center gap-1.5 text-label font-bold text-ember-700 hover:underline">
          <Phone className="size-4" aria-hidden />
          Call {so.stall.name}
        </a>
      )}
    </article>
  );
}

function PaymentPanel({ order, onPaid }: { order: Order; onPaid: () => void }) {
  const [start, setStart] = useState<PaymentStart | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      setStart(await backend().startPayment(order.id));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const payDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      await backend().confirmDemoPayment(order.id);
      onPaid();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-ember-400 bg-ember-50 p-4 md:p-5" aria-labelledby="pay-heading">
      <h2 id="pay-heading" className="flex items-center gap-2 text-subheading font-extrabold">
        <CreditCard className="size-5" aria-hidden />
        Pay {money(order.total_cents)} to send your order
      </h2>
      <p className="mt-1 text-label font-medium text-ink-700">The stalls start cooking as soon as the payment goes through.</p>

      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}

      {confirming ? (
        <p className="mt-4 flex items-center gap-2 text-label font-semibold">
          <Spinner className="text-ink-900" /> Payment received. Sending your order to the stalls…
        </p>
      ) : !start ? (
        <Button size="lg" className="mt-4 w-full sm:w-auto" loading={busy} onClick={begin}>
          Pay {money(order.total_cents)}
        </Button>
      ) : start.kind === "demo" ? (
        <div className="mt-4 rounded-sm border border-line bg-white p-4 md:rounded-[4px]">
          <p className="text-label font-bold">Demo payment</p>
          <p className="mt-1 text-small text-ink-700">No card is charged. With Stripe connected, the card, Apple Pay and Google Pay form appears here.</p>
          <Button className="mt-3 w-full sm:w-auto" loading={busy} onClick={payDemo}>
            Simulate successful payment
          </Button>
        </div>
      ) : (
        <div className="mt-4 rounded-sm border border-line bg-white p-4 md:rounded-[4px]">
          <StripePay
            clientSecret={start.client_secret}
            publishableKey={start.publishable_key}
            amountLabel={money(order.total_cents)}
            returnUrl={typeof window !== "undefined" ? window.location.href : ""}
            onSucceeded={() => {
              setConfirming(true);
              onPaid();
            }}
          />
        </div>
      )}
    </section>
  );
}

function headline(order: Order): string {
  if (order.status === "awaiting_payment") return "Almost there";
  if (order.status === "cancelled") return "Order cancelled";
  if (order.status === "completed") return "Order complete";
  const live = order.stall_orders.filter((s) => s.status !== "cancelled" && s.status !== "completed");
  const ready = live.filter((s) => s.status === "ready");
  if (ready.length && ready.length === live.length) {
    return order.fulfilment === "table" ? "On its way to your table" : ready.length === 1 ? `Token ${ready[0].token_no} is ready` : "Everything is ready";
  }
  if (ready.length) return order.fulfilment === "table" ? "First dishes are on their way" : `Token ${ready[0].token_no} is ready`;
  if (live.some((s) => s.status === "preparing")) return "Your order is being prepared";
  return "Order sent to the stalls";
}

export function OrderScreen({ id }: { id: string }) {
  const { order, isLoading, error, reload } = useOrder(id);
  const { session, isLoading: sessionLoading } = useSession("customer");
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading || sessionLoading || (order === undefined && !error)) {
    return (
      <Container className="max-w-[720px] py-8" aria-hidden>
        <div className="skeleton h-9 w-64" />
        <div className="skeleton mt-3 h-4 w-48" />
        <div className="skeleton mt-6 h-44 rounded-lg" />
        <div className="skeleton mt-4 h-44 rounded-lg" />
      </Container>
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={<Receipt className="size-7" aria-hidden />}
        title="We could not find that order"
        body={session ? "It may belong to a different phone number." : "Sign in with the phone number you ordered with to see it."}
        action={session ? <ButtonLink href="/orders">Your orders</ButtonLink> : <ButtonLink href={`/account?next=/orders/${id}`}>Sign in</ButtonLink>}
      />
    );
  }

  const cancellable =
    (order.status === "active" || order.status === "awaiting_payment") && order.stall_orders.every((s) => ["pending", "placed", "cancelled"].includes(s.status));
  const paymentText =
    order.payment_status === "paid" ? "Paid online" : order.payment_status === "refunded" ? "Refunded" : order.payment_method === "online" ? "Not paid yet" : "Pay at the stall";

  const cancel = async () => {
    setCancelling(true);
    setActionError(null);
    try {
      await backend().cancelOrder(order.id);
      setConfirmCancel(false);
      await reload();
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Container className="max-w-[720px] pt-3 pb-10">
      <Link href="/orders" className="-ml-1.5 inline-flex h-10 items-center gap-1 rounded-md pr-2 text-label font-bold text-ink-700 hover:text-ink-900">
        <ChevronLeft className="size-5" aria-hidden />
        Your orders
      </Link>

      <h1 className="mt-2 text-title md:text-display" aria-live="polite">
        {headline(order)}
      </h1>
      <p className="mt-1.5 flex flex-wrap gap-x-2 text-label font-medium text-ink-700">
        <span className="font-bold text-ink-900 tabular-nums">{order.order_no}</span>
        <span aria-hidden>·</span>
        <span>{dayAndTime(order.created_at)}</span>
        <span aria-hidden>·</span>
        <span>{order.fulfilment === "table" ? `Table ${order.table_no}` : "Pickup"}</span>
        <span aria-hidden>·</span>
        <span>{paymentText}</span>
      </p>

      <div className="mt-6 space-y-4">
        {order.status === "awaiting_payment" && <PaymentPanel order={order} onPaid={() => void reload()} />}

        {order.status === "active" && order.fulfilment === "pickup" && order.payment_method === "pay_at_stall" && (
          <Notice>Pay each stall for its part when you collect. Show the token number.</Notice>
        )}

        {order.stall_orders.map((so) => (
          <TokenCard key={so.id} so={so} order={order} />
        ))}
      </div>

      {order.note && (
        <p className="mt-5 text-label text-ink-700">
          <span className="font-bold text-ink-900">Your note:</span> {order.note}
        </p>
      )}

      <section className="mt-6 rounded-lg bg-surface-1 p-4 md:p-5" aria-labelledby="bill-heading">
        <h2 id="bill-heading" className="text-label font-bold">
          Bill
        </h2>
        <dl className="mt-2 space-y-1.5 text-label font-medium text-ink-700">
          <div className="flex justify-between">
            <dt>Item total</dt>
            <dd className="tabular-nums">{money(order.item_total_cents)}</dd>
          </div>
          {order.tax_cents > 0 && (
            <div className="flex justify-between">
              <dt>Sales tax</dt>
              <dd className="tabular-nums">{money(order.tax_cents)}</dd>
            </div>
          )}
          {order.service_fee_cents > 0 && (
            <div className="flex justify-between">
              <dt>Service fee</dt>
              <dd className="tabular-nums">{money(order.service_fee_cents)}</dd>
            </div>
          )}
          {order.tip_cents > 0 && (
            <div className="flex justify-between">
              <dt>Tip</dt>
              <dd className="tabular-nums">{money(order.tip_cents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-body font-extrabold text-ink-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(order.total_cents)}</dd>
          </div>
        </dl>
      </section>

      {actionError && (
        <Notice tone="error" className="mt-4">
          {actionError}
        </Notice>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ButtonLink href="/" variant="outline">
          Order something else
        </ButtonLink>
        {cancellable &&
          (confirmCancel ? (
            <>
              <Button variant="danger" loading={cancelling} onClick={cancel}>
                Yes, cancel this order
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={cancelling}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="text-chili-600" onClick={() => setConfirmCancel(true)}>
              Cancel order
            </Button>
          ))}
      </div>

      {isDemo && order.status === "active" && (
        <Notice tone="warn" className="mt-6">
          Demo: to move this order along, open the{" "}
          <a href="/partner" target="_blank" rel="noreferrer" className="font-bold underline">
            stall dashboard
          </a>{" "}
          in another tab and accept it there. This page updates on its own.
        </Notice>
      )}
    </Container>
  );
}
