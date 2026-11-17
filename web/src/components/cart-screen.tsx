"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Armchair, Banknote, CreditCard, Plus, ShoppingBag, Ticket, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { backend, formatPhone } from "@/lib/backend";
import { useCart, useCartView } from "@/lib/cart";
import { computeBill, friendlyError, imageSrc, money, plural } from "@/lib/format";
import { useCatalog, useSession } from "@/lib/hooks";
import type { Fulfilment, PaymentMethod } from "@/lib/types";
import { AddButton } from "./add-button";
import { Button, ButtonLink, cn, Container, DietMark, EmptyState, Field, inputClass, Notice } from "./ui";

function Choice<T extends string>({
  name,
  value,
  current,
  onSelect,
  icon,
  title,
  body,
}: {
  name: string;
  value: T;
  current: T;
  onSelect: (v: T) => void;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const selected = value === current;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ember-600",
        selected ? "border-night-900 bg-surface-1 shadow-[inset_0_0_0_1px_var(--color-night-900)]" : "border-line hover:bg-surface-1",
      )}
    >
      <input type="radio" name={name} value={value} checked={selected} onChange={() => onSelect(value)} className="sr-only" />
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", selected ? "bg-night-900 text-white" : "bg-surface-2 text-ink-700")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] leading-5 font-bold">{title}</span>
        <span className="mt-0.5 block text-small text-ink-700">{body}</span>
      </span>
    </label>
  );
}

function BillRows({ rows, total }: { rows: [string, number][]; total: number }) {
  return (
    <dl className="space-y-2 text-label font-medium text-ink-700">
      {rows.map(([label, cents]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt>{label}</dt>
          <dd className="tabular-nums">{money(cents)}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-line pt-3 text-body font-extrabold text-ink-900">
        <dt>To pay</dt>
        <dd className="tabular-nums">{money(total)}</dd>
      </div>
    </dl>
  );
}

export function CartScreen() {
  const router = useRouter();
  const cart = useCartView();
  const { fulfilment, tableNo, note, paymentMethod, set, remove, clear } = useCart();
  const { index } = useCatalog();
  const { session, isLoading: sessionLoading } = useSession("customer");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Prefill the name from the profile once it is known, without overwriting what was typed.
  const profileName = session?.profile.full_name ?? "";
  const [seededName, setSeededName] = useState("");
  if (profileName && seededName !== profileName) {
    setSeededName(profileName);
    if (!name) setName(profileName);
  }

  const park = index?.catalog.park;
  const tableAllowed = park?.table_service_enabled ?? true;
  const effectiveFulfilment: Fulfilment = tableAllowed ? fulfilment : "pickup";

  if (!cart.ready || !park) {
    return (
      <Container className="max-w-[1000px] py-8" aria-hidden>
        <div className="skeleton h-8 w-40" />
        <div className="mt-6 space-y-4">
          <div className="skeleton h-40 rounded-lg" />
          <div className="skeleton h-28 rounded-lg" />
        </div>
      </Container>
    );
  }

  if (cart.count === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-7" aria-hidden />}
        title="Your cart is empty"
        body="Add dishes from any stall. Everything goes into one cart and one checkout."
        action={<ButtonLink href="/">Browse the food trucks</ButtonLink>}
      />
    );
  }

  const bill = computeBill(cart.item_total_cents, park);
  const billRows: [string, number][] = [[`Item total (${plural(cart.count, "item")})`, bill.item_total_cents]];
  if (bill.tax_cents > 0) billRows.push([`Sales tax (${park.tax_percent}%)`, bill.tax_cents]);
  if (bill.service_fee_cents > 0) billRows.push(["Service fee", bill.service_fee_cents]);

  const nameError = touched && !name.trim() ? "Add your name so the stall can call it out." : null;
  const tableError = touched && effectiveFulfilment === "table" && !tableNo.trim() ? "Enter the number on your table." : null;
  const pay = paymentMethod === "online";

  const placeOrder = async () => {
    setTouched(true);
    setError(null);
    if (!name.trim() || (effectiveFulfilment === "table" && !tableNo.trim())) {
      document.getElementById(!name.trim() ? "customer-name" : "table-no")?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await backend().placeOrder({
        fulfilment: effectiveFulfilment,
        table_no: effectiveFulfilment === "table" ? tableNo.trim() : null,
        customer_name: name.trim(),
        customer_phone: session?.profile.phone ?? null,
        note: note.trim() || null,
        payment_method: paymentMethod,
        tip_cents: 0,
        items: cart.groups.flatMap((g) => g.lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty }))),
      });
      clear();
      router.push(`/orders/${result.order_id}`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  const cta = !session ? (
    <ButtonLink href="/account?next=/cart" size="lg" className="w-full">
      Sign in to place order
    </ButtonLink>
  ) : (
    <Button size="lg" className="w-full" loading={busy} disabled={cart.blocked || !park.ordering_enabled} onClick={placeOrder}>
      {pay ? `Continue to pay ${money(bill.total_cents)}` : `Place order · ${money(bill.total_cents)}`}
    </Button>
  );

  const blockers = (
    <>
      {!park.ordering_enabled && <Notice tone="warn">The park is not taking online orders right now.</Notice>}
      {cart.blocked && <Notice tone="error">Remove the items marked unavailable to continue.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );

  return (
    <Container className="max-w-[1000px] pt-5 pb-36 md:pt-8 lg:pb-10">
      <h1 className="text-title md:text-display">Your cart</h1>
      <p className="mt-1 text-ink-700">
        {plural(cart.count, "item")} from {plural(cart.groups.length, "stall")}. Each stall prepares its own part and gives you a token.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <div className="space-y-4">
            {cart.groups.map(({ stall, lines, subtotal_cents }) => (
              <section key={stall.id} aria-label={stall.name} className="rounded-lg border border-line">
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                  {stall.logo_url && <img src={imageSrc(stall.logo_url)!} alt="" className="size-10 rounded-full border border-line bg-white object-cover" />}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[1.0625rem] leading-6 font-extrabold">
                      <Link href={`/stall/${stall.slug}`} className="hover:underline">
                        {stall.name}
                      </Link>
                    </h2>
                    {!stall.is_open && <p className="text-small font-semibold text-chili-600">Closed right now</p>}
                  </div>
                  <p className="text-label font-bold tabular-nums">{money(subtotal_cents)}</p>
                </header>
                <ul className="divide-y divide-line px-4">
                  {lines.map(({ item, qty, orderable }) => (
                    <li key={item.id} className="flex items-center gap-3 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-start gap-1.5 text-[0.9375rem] leading-5 font-semibold">
                          <DietMark diet={item.diet} className="mt-0.5" />
                          <span>{item.name}</span>
                        </p>
                        {orderable ? (
                          <p className="mt-0.5 text-small text-ink-500 tabular-nums">{money(item.price_cents)} each</p>
                        ) : (
                          <p className="mt-0.5 text-small font-semibold text-chili-600">{item.is_available ? "Stall closed" : "Sold out"}</p>
                        )}
                      </div>
                      {orderable ? (
                        <AddButton item={item} stallOpen={stall.is_open} className="shadow-none" />
                      ) : (
                        <Button variant="danger" size="sm" onClick={() => remove(item.id)}>
                          <Trash2 className="size-4" aria-hidden />
                          Remove
                        </Button>
                      )}
                      <p className="w-16 text-right text-label font-bold tabular-nums">{money(item.price_cents * qty)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-md text-label font-bold text-ember-700 hover:underline">
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              Add from another stall
            </Link>
          </div>

          <fieldset>
            <legend className="text-heading">How do you want it?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Choice<Fulfilment>
                name="fulfilment"
                value="pickup"
                current={effectiveFulfilment}
                onSelect={(v) => set({ fulfilment: v })}
                icon={<Ticket className="size-4.5" aria-hidden />}
                title="Pick up at the stall"
                body="You get a token for each stall. Collect when it shows Ready."
              />
              {tableAllowed && (
                <Choice<Fulfilment>
                  name="fulfilment"
                  value="table"
                  current={effectiveFulfilment}
                  onSelect={(v) => set({ fulfilment: v })}
                  icon={<Armchair className="size-4.5" aria-hidden />}
                  title="Bring it to my table"
                  body="Tell us your table number and each stall brings its dishes over."
                />
              )}
            </div>
            {effectiveFulfilment === "table" && (
              <div className="mt-4 max-w-48">
                <Field label="Table number" htmlFor="table-no" error={tableError}>
                  <input
                    id="table-no"
                    inputMode="numeric"
                    value={tableNo}
                    onChange={(e) => set({ tableNo: e.target.value.slice(0, 8) })}
                    placeholder="e.g. 12"
                    className={inputClass}
                    aria-invalid={Boolean(tableError)}
                  />
                </Field>
              </div>
            )}
          </fieldset>

          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-heading">
              Your details
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Name for the order" htmlFor="customer-name" error={nameError}>
                <input
                  id="customer-name"
                  autoComplete="given-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                  placeholder="First name"
                  className={inputClass}
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
              <Field label="Mobile number" htmlFor="customer-phone" hint={session ? undefined : "Sign in to add your number."}>
                <input id="customer-phone" value={formatPhone(session?.profile.phone)} placeholder="Not signed in" readOnly disabled className={inputClass} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Note for the stalls (optional)" htmlFor="order-note" hint="Spice level, no onions, and so on. Stalls will do their best.">
                <textarea
                  id="order-note"
                  rows={2}
                  value={note}
                  onChange={(e) => set({ note: e.target.value.slice(0, 200) })}
                  className={`${inputClass} h-auto py-3`}
                />
              </Field>
            </div>
          </section>

          <fieldset>
            <legend className="text-heading">Payment</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Choice<PaymentMethod>
                name="payment"
                value="online"
                current={paymentMethod}
                onSelect={(v) => set({ paymentMethod: v })}
                icon={<CreditCard className="size-4.5" aria-hidden />}
                title="Pay now"
                body="Card, Apple Pay or Google Pay. One payment covers every stall."
              />
              <Choice<PaymentMethod>
                name="payment"
                value="pay_at_stall"
                current={paymentMethod}
                onSelect={(v) => set({ paymentMethod: v })}
                icon={<Banknote className="size-4.5" aria-hidden />}
                title="Pay at the stall"
                body="Pay each stall for its part when you collect."
              />
            </div>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-line p-5">
            <h2 className="text-subheading font-extrabold">Bill details</h2>
            <div className="mt-4">
              <BillRows rows={billRows} total={bill.total_cents} />
            </div>
            <div className="mt-5 hidden space-y-3 lg:block">
              {blockers}
              {!sessionLoading && cta}
            </div>
          </div>
        </aside>
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-line bg-white px-4 pt-3 shadow-up md:bottom-0 lg:hidden">
        <div className="mx-auto mb-3 max-w-lg space-y-2">
          {blockers}
          {!sessionLoading && cta}
        </div>
      </div>
    </Container>
  );
}
