"use client";

import { Armchair, BellRing, ChefHat, Ticket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { backend } from "@/lib/backend";
import { friendlyError, minutesSince, money, plural, timeOfDay } from "@/lib/format";
import { useCatalog, useNow, useSession, useStallTickets } from "@/lib/hooks";
import type { StallTicket, TicketStatus } from "@/lib/types";
import { StaffHeader, StaffSignIn } from "./staff-shell";
import { Button, cn, Container, DietMark, Notice, Spinner, Switch } from "./ui";

type Lane = "placed" | "preparing" | "ready";

const lanes: { key: Lane; title: string; empty: string; action: string; next: TicketStatus }[] = [
  { key: "placed", title: "New", empty: "No new orders. They appear here the moment a customer orders.", action: "Accept and start", next: "preparing" },
  { key: "preparing", title: "Preparing", empty: "Nothing on the stove.", action: "Mark ready", next: "ready" },
  { key: "ready", title: "Ready", empty: "Nothing waiting for pickup.", action: "Handed over", next: "completed" },
];

function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch {
    // Sound is a nicety; the board still shows the order.
  }
}

function TicketCard({ ticket, lane, now, onMove }: { ticket: StallTicket; lane: (typeof lanes)[number]; now: number; onMove: (status: TicketStatus) => Promise<void> }) {
  const [busy, setBusy] = useState<TicketStatus | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const waited = minutesSince(ticket.placed_at ?? ticket.created_at, now);
  const table = ticket.order.fulfilment === "table";
  const collect = ticket.order.payment_method === "pay_at_stall" && ticket.order.payment_status !== "paid";
  // What this stall collects: its dishes, minus its share of any coupon, plus its share of tax.
  const due = ticket.subtotal_cents - (ticket.discount_cents ?? 0) + (ticket.tax_cents ?? 0);

  const move = async (status: TicketStatus) => {
    setBusy(status);
    await onMove(status);
    setBusy(null);
    setConfirmReject(false);
  };

  return (
    <li className="animate-fade-in rounded-md border border-line bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex min-w-16 flex-col items-center rounded-[4px] bg-night-900 px-2 py-1.5 text-white">
          <span className="text-caption font-semibold text-night-muted">Token</span>
          <span className="text-[1.75rem] leading-8 font-extrabold tracking-tight tabular-nums">{ticket.token_no}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.0625rem] leading-6 font-extrabold">{ticket.order.customer_name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-small font-semibold text-ink-700">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", table ? "bg-ember-100 text-ember-700" : "bg-surface-2")}>
              {table ? <Armchair className="size-3.5" aria-hidden /> : <Ticket className="size-3.5" aria-hidden />}
              {table ? `Table ${ticket.order.table_no}` : "Pickup"}
            </span>
            <span className="tabular-nums">{timeOfDay(ticket.placed_at ?? ticket.created_at)}</span>
            <span className={cn("tabular-nums", waited >= 15 && lane.key !== "ready" && "text-chili-600")}>{waited} min ago</span>
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
        {ticket.order_items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-[0.9375rem] leading-5 font-semibold">
            <span className="w-7 shrink-0 text-right font-extrabold tabular-nums">{item.qty}×</span>
            <DietMark diet={item.diet} className="mt-0.5" />
            <span className="min-w-0 flex-1">{item.name}</span>
          </li>
        ))}
      </ul>

      {ticket.order.note && (
        <p className="mt-3 rounded-md bg-ember-50 px-3 py-2 text-label font-medium">
          <span className="font-bold">Note:</span> {ticket.order.note}
        </p>
      )}

      <p className={cn("mt-3 text-label font-bold tabular-nums", collect ? "text-chili-600" : "text-leaf-700")}>
        {collect
          ? `Collect ${money(due)} from the customer${ticket.discount_cents ? " (coupon applied)" : ticket.tax_cents ? " (tax included)" : ""}`
          : `Paid online · ${money(due)}`}
      </p>

      <div className="mt-3 flex gap-2">
        {confirmReject ? (
          <>
            <Button variant="danger" className="flex-1" loading={busy === "cancelled"} onClick={() => move("cancelled")}>
              Yes, reject
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setConfirmReject(false)}>
              Keep order
            </Button>
          </>
        ) : (
          <>
            <Button variant={lane.key === "ready" ? "dark" : "success"} className="h-12 flex-1" loading={busy === lane.next} onClick={() => move(lane.next)}>
              {lane.action}
            </Button>
            {lane.key !== "ready" && (
              <Button variant="ghost" className="h-12 text-chili-600" onClick={() => setConfirmReject(true)}>
                {lane.key === "placed" ? "Reject" : "Cancel"}
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function Board({ stallId }: { stallId: string }) {
  const { tickets, error, reload } = useStallTickets(stallId);
  const now = useNow();
  const [lane, setLane] = useState<Lane>("placed");
  const [sound, setSound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);

  // Chime when a ticket we have not seen before lands in New.
  useEffect(() => {
    if (!tickets) return;
    const fresh = tickets.filter((t) => t.status === "placed").map((t) => t.id);
    if (seen.current && sound && fresh.some((id) => !seen.current!.has(id))) chime();
    seen.current = new Set(tickets.map((t) => t.id));
  }, [tickets, sound]);

  if (error && !tickets) return <Notice tone="error">Could not load orders. Check the connection; this screen retries on its own.</Notice>;
  if (!tickets)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );

  const byLane = (key: Lane) =>
    tickets.filter((t) => t.status === key).sort((a, b) => (a.placed_at ?? a.created_at).localeCompare(b.placed_at ?? b.created_at));
  const done = tickets.filter((t) => t.status === "completed" || t.status === "cancelled");

  const move = async (id: string, status: TicketStatus) => {
    setActionError(null);
    try {
      await backend().setStallOrderStatus(id, status);
    } catch (err) {
      setActionError(friendlyError(err));
    }
    await reload();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5 lg:hidden" role="tablist" aria-label="Order stage">
          {lanes.map((l) => {
            const count = byLane(l.key).length;
            return (
              <button
                key={l.key}
                type="button"
                role="tab"
                aria-selected={lane === l.key}
                onClick={() => setLane(l.key)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-label font-bold transition-colors duration-150",
                  lane === l.key ? "bg-night-900 text-white" : "bg-surface-2 text-ink-700",
                )}
              >
                {l.title}
                <span className={cn("rounded-full px-1.5 text-caption tabular-nums", l.key === "placed" && count > 0 ? "bg-ember-500 text-night-900" : "bg-white/20")}>{count}</span>
              </button>
            );
          })}
        </div>
        <p className="hidden text-label font-medium text-ink-700 lg:block">Orders move left to right. Customers see every change as it happens.</p>
        <button
          type="button"
          aria-pressed={sound}
          onClick={() => {
            if (!sound) chime();
            setSound(!sound);
          }}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-label font-bold transition-colors duration-150",
            sound ? "border-leaf-600 bg-leaf-50 text-leaf-700" : "border-line text-ink-700 hover:bg-surface-1",
          )}
        >
          <BellRing className="size-4" aria-hidden />
          <span>{sound ? "Sound on" : "Sound off"}</span>
        </button>
      </div>

      {actionError && (
        <Notice tone="error" className="mt-3">
          {actionError}
        </Notice>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        {lanes.map((l) => {
          const list = byLane(l.key);
          return (
            <section key={l.key} aria-label={l.title} className={cn("rounded-xl bg-surface-1 p-3", lane !== l.key && "hidden lg:block")}>
              <h2 className="flex items-center gap-2 px-1 pb-3 text-subheading font-extrabold">
                {l.title}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-caption font-bold tabular-nums",
                    l.key === "placed" && list.length > 0 ? "bg-ember-500 text-night-900" : "bg-surface-2 text-ink-700",
                  )}
                >
                  {list.length}
                </span>
              </h2>
              {list.length === 0 ? (
                <p className="px-1 pb-4 text-label font-medium text-ink-500">{l.empty}</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((t) => (
                    <TicketCard key={t.id} ticket={t} lane={l} now={now} onMove={(status) => move(t.id, status)} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {done.length > 0 && (
        <details className="mt-6 rounded-lg border border-line">
          <summary className="flex h-12 list-none items-center justify-between px-4 text-label font-bold">
            Finished in the last day
            <span className="font-semibold text-ink-500 tabular-nums">{plural(done.length, "order")}</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line px-4">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5 text-label font-medium">
                <span className="w-14 font-bold tabular-nums">#{t.token_no}</span>
                <span className="min-w-0 flex-1 truncate">
                  {t.order.customer_name} · {plural(t.order_items.reduce((n, i) => n + i.qty, 0), "item")}
                </span>
                <span className={cn("font-bold", t.status === "cancelled" ? "text-chili-600" : "text-ink-500")}>{t.status === "cancelled" ? "Cancelled" : "Handed over"}</span>
                <span className="w-16 text-right tabular-nums">{money(t.subtotal_cents - (t.discount_cents ?? 0) + (t.tax_cents ?? 0))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Stock({ stallId }: { stallId: string }) {
  const { index } = useCatalog();
  const [error, setError] = useState<string | null>(null);
  if (!index) return <Spinner />;
  const categories = index.categoriesByStall.get(stallId) ?? [];
  const items = index.itemsByStall.get(stallId) ?? [];
  const out = items.filter((m) => !m.is_available).length;

  const toggle = async (id: string, available: boolean) => {
    setError(null);
    try {
      await backend().setItemAvailable(id, available);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-label font-medium text-ink-700">
        Switch a dish off when it runs out. Customers see “Sold out” straight away. {out > 0 ? `${plural(out, "dish", "dishes")} off right now.` : "Everything is on."}
      </p>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      {categories.map((c) => (
        <section key={c.id} className="mt-6" aria-label={c.name}>
          <h2 className="text-subheading font-extrabold">{c.name}</h2>
          <ul className="mt-1 divide-y divide-line">
            {items
              .filter((m) => m.category_id === c.id)
              .map((m) => (
                <li key={m.id} className="flex min-h-14 items-center gap-3 py-2">
                  <DietMark diet={m.diet} />
                  <span className={cn("min-w-0 flex-1 font-semibold", !m.is_available && "text-ink-500 line-through")}>{m.name}</span>
                  <span className="text-label font-medium text-ink-500 tabular-nums">{money(m.price_cents)}</span>
                  <Switch checked={m.is_available} onChange={(v) => toggle(m.id, v)} label={`${m.name} in stock`} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PartnerScreen() {
  const { session, isLoading } = useSession("staff");
  const { index } = useCatalog();
  const [tab, setTab] = useState<"orders" | "menu">("orders");
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stallIds = session?.staff_stall_ids ?? [];
  const stallId = chosen && stallIds.includes(chosen) ? chosen : (stallIds[0] ?? null);
  const stall = stallId ? index?.stallById.get(stallId) : undefined;

  const setOpen = async (open: boolean) => {
    if (!stallId) return;
    setError(null);
    try {
      await backend().setStallOpen(stallId, open);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <StaffHeader title={stall?.name ?? "Stall dashboard"} session={session}>
        {stall && (
          <label className="flex items-center gap-2.5 rounded-md px-2 text-label font-bold">
            <span className={stall.is_open ? "text-white" : "text-night-muted"}>{stall.is_open ? "Taking orders" : "Closed"}</span>
            <Switch checked={stall.is_open} onChange={setOpen} label="Stall is taking orders" />
          </label>
        )}
      </StaffHeader>

      {isLoading || !index ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !session ? (
        <StaffSignIn want="stall_staff" />
      ) : !stallId || !stall ? (
        <Container className="max-w-md py-10">
          <h1 className="text-title">No stall on this account</h1>
          <p className="mt-2 text-ink-700">Ask the park admin to link your account to your stall, then sign in again.</p>
        </Container>
      ) : (
        <Container className="flex-1 py-5">
          {error && (
            <Notice tone="error" className="mb-4">
              {error}
            </Notice>
          )}
          {!stall.is_open && (
            <Notice tone="warn" className="mb-4">
              You are closed, so customers cannot add your dishes. Orders already placed still need to be finished.
            </Notice>
          )}
          <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line">
            {(
              [
                ["orders", "Orders", ChefHat],
                ["menu", "Menu stock", Ticket],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "-mb-px h-11 border-b-[3px] px-1 text-[0.9375rem] transition-colors duration-150",
                  tab === key ? "border-ember-500 font-extrabold text-ink-900" : "border-transparent font-semibold text-ink-500 hover:text-ink-900",
                )}
              >
                {label}
              </button>
            ))}
            {stallIds.length > 1 && (
              <select
                aria-label="Stall"
                value={stallId}
                onChange={(e) => setChosen(e.target.value)}
                className="mb-1.5 ml-auto h-10 rounded-md border border-line bg-white px-3 text-label font-bold"
              >
                {stallIds.map((id) => (
                  <option key={id} value={id}>
                    {index.stallById.get(id)?.name ?? id}
                  </option>
                ))}
              </select>
            )}
          </div>
          {tab === "orders" ? <Board stallId={stallId} /> : <Stock stallId={stallId} />}
        </Container>
      )}
    </div>
  );
}
