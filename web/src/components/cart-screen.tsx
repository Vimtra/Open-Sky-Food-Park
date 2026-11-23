"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Armchair, Banknote, Clock, CreditCard, Minus, Plus, ShoppingBag, Ticket, Timer, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { backend, formatPhone } from "@/lib/backend";
import { MAX_QTY, useCart, useCartView, type CartLine } from "@/lib/cart";
import useSWR from "swr";
import { computeBill, friendlyError, imageSrc, money, plural } from "@/lib/format";
import { optionsText } from "@/lib/options";
import { parkDate } from "@/lib/reports";
import type { CatalogIndex } from "@/lib/hooks";
import { CouponBox } from "./coupon-box";
import { useCatalog, useNow, useSession, useStallLive } from "@/lib/hooks";
import type { Fulfilment, PaymentMethod } from "@/lib/types";
import { DishCard } from "./cards";
import { Button, ButtonLink, cn, Container, DietMark, EmptyState, Field, FoodImage, inputClass, Notice } from "./ui";

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
        <div key={label} className={cents < 0 ? "flex justify-between gap-4 font-bold text-leaf-700" : "flex justify-between gap-4"}>
          <dt>{label}</dt>
          <dd className="tabular-nums">{cents < 0 ? `−${money(-cents)}` : money(cents)}</dd>
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
  const { fulfilment, tableNo, note, paymentMethod, pickupAt, set, remove, clear } = useCart();
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

  // Coupon: kept by code and re-checked against the server whenever the cart changes.
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const couponItems = cart.groups.flatMap((g) => g.lines.filter((l) => l.orderable).map((l) => ({ menu_item_id: l.item.id, qty: l.qty, option_ids: l.option_ids })));
  const couponKey = couponCode && couponItems.length ? ["coupon", couponCode, JSON.stringify(couponItems)] : null;
  const { data: couponQuote, error: couponErr, isValidating: couponChecking } = useSWR(couponKey, () => backend().quoteCoupon(couponCode!, couponItems), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const couponError = couponErr ? friendlyError(couponErr) : null;
  const applyCoupon = async (code: string) => {
    try {
      await backend().quoteCoupon(code, couponItems);
      setCouponCode(code);
      return null;
    } catch (err) {
      return friendlyError(err);
    }
  };

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

  const discount = couponCode && couponQuote && !couponError ? couponQuote.discount_cents : 0;
  const bill = computeBill(cart.item_total_cents, park, 0, discount);
  const billRows: [string, number][] = [[`Item total (${plural(cart.count, "item")})`, bill.item_total_cents]];
  if (bill.discount_cents > 0) billRows.push([`Coupon ${couponQuote?.code ?? ""}`, -bill.discount_cents]);
  if (bill.tax_cents > 0) billRows.push([`Sales tax (${park.tax_percent}%)`, bill.tax_cents]);
  if (bill.service_fee_cents > 0) billRows.push(["Service fee", bill.service_fee_cents]);

  // Order for later: only when the park allows it (the time itself is checked when placing the order).
  const later = Boolean(park.scheduled_orders_enabled) && Boolean(pickupAt);
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
    if (later && new Date(pickupAt).getTime() < Date.now() + 10 * 60000) {
      setError("That pickup time has passed. Pick a later time, or choose as soon as possible.");
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
        coupon_code: discount > 0 ? couponCode : null,
        pickup_at: later ? pickupAt : null,
        items: cart.groups.flatMap((g) => g.lines.map((l) => ({ menu_item_id: l.item.id, qty: l.qty, option_ids: l.option_ids, note: l.note.trim() || null }))),
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
            {cart.groups.map(({ stall, lines, subtotal_cents, label, accepting }) => (
              <section key={stall.id} aria-label={stall.name} className="rounded-lg border border-line">
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                  {stall.logo_url && <img src={imageSrc(stall.logo_url)!} alt="" className="size-10 rounded-full border border-line bg-white object-cover" />}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[1.0625rem] leading-6 font-extrabold">
                      <Link href={`/stall/${stall.slug}`} className="hover:underline">
                        {stall.name}
                      </Link>
                    </h2>
                    {label && (
                      <p className={cn("flex items-center gap-1 text-small font-semibold", accepting ? "text-ink-500" : "text-chili-600")}>
                        {accepting && <Timer className="size-3.5" aria-hidden />}
                        {accepting ? `Usually ready in ${label.replace("~", "about ")}` : label}
                      </p>
                    )}
                  </div>
                  <p className="text-label font-bold tabular-nums">{money(subtotal_cents)}</p>
                </header>
                <ul className="divide-y divide-line px-4">
                  {lines.map((line) => (
                    <CartLineRow key={line.key} line={line} onRemove={() => remove(line.key)} />
                  ))}
                </ul>
              </section>
            ))}
            <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-md text-label font-bold text-ember-700 hover:underline">
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              Add from another stall
            </Link>
          </div>

          {index && <Suggestions index={index} inCart={new Set(cart.groups.flatMap((g) => g.lines.map((l) => l.item.id)))} cartStalls={new Set(cart.groups.map((g) => g.stall.id))} />}

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

          {park.scheduled_orders_enabled && <PickupTime value={pickupAt} onChange={(v) => set({ pickupAt: v })} tz={park.timezone} />}

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
              <Field label="Signed in as" htmlFor="customer-phone" hint={session ? undefined : "Sign in with Google or your mobile number."}>
                <input
                  id="customer-phone"
                  value={formatPhone(session?.profile.phone) || session?.email || ""}
                  placeholder="Not signed in"
                  readOnly
                  disabled
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Note for the whole order (optional)" htmlFor="order-note" hint="Anything every truck should know. For one dish, use “Add a note” on that dish.">
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
            {park.coupons_enabled && (
              <div className="mb-5 border-b border-line pb-5">
                <CouponBox
                  code={couponCode}
                  quote={couponQuote}
                  quoteError={couponError}
                  checking={couponChecking && !couponQuote}
                  onApply={applyCoupon}
                  onRemove={() => setCouponCode(null)}
                />
              </div>
            )}
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

/** One cart line: dish, its options, its own note, and a stepper for that exact line. */
function CartLineRow({ line, onRemove }: { line: CartLine; onRemove: () => void }) {
  const add = useCart((s) => s.add);
  const decrement = useCart((s) => s.decrement);
  const setLineNote = useCart((s) => s.setLineNote);
  const [editing, setEditing] = useState(false);
  const { item, qty, orderable, problem, options, note, unit_price_cents, key } = line;

  return (
    <li className="py-3.5">
      <div className="flex items-center gap-3">
        <FoodImage src={imageSrc(item.image_url)} alt="" className={cn("size-14 shrink-0 rounded-md md:size-16", !orderable && "opacity-50 grayscale")} />
        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-1.5 text-[0.9375rem] leading-5 font-semibold">
            <DietMark diet={item.diet} className="mt-0.5" />
            <span>{item.name}</span>
          </p>
          {options.length > 0 && <p className="mt-0.5 text-small text-ink-700">{optionsText(options, money)}</p>}
          {orderable ? (
            <p className="mt-0.5 text-small text-ink-500 tabular-nums">{money(unit_price_cents)} each</p>
          ) : (
            <p className="mt-0.5 text-small font-semibold text-chili-600">{problem}</p>
          )}
        </div>
        {orderable ? (
          <div className="inline-flex h-9 w-24 items-stretch overflow-hidden rounded-md border border-line bg-white text-label font-extrabold text-leaf-600 tabular-nums" role="group" aria-label={`${item.name} quantity`}>
            <button type="button" onClick={() => decrement(key)} aria-label={qty === 1 ? `Remove ${item.name}` : `Decrease ${item.name}`} className="hit-44 relative flex w-8 items-center justify-center hover:bg-leaf-50">
              <Minus className="size-4" strokeWidth={2.75} aria-hidden />
            </button>
            <span className="flex flex-1 items-center justify-center" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => add(item.id, line.option_ids)}
              disabled={qty >= MAX_QTY}
              aria-label={`Increase ${item.name}`}
              className="hit-44 relative flex w-8 items-center justify-center hover:bg-leaf-50 disabled:text-ink-300"
            >
              <Plus className="size-4" strokeWidth={2.75} aria-hidden />
            </button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={onRemove}>
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>
        )}
        <p className="w-16 text-right text-label font-bold tabular-nums">{money(unit_price_cents * qty)}</p>
      </div>
      {orderable && (
        <div className="mt-2 pl-17 md:pl-19">
          {editing ? (
            <input
              autoFocus
              value={note}
              maxLength={140}
              onChange={(e) => setLineNote(key, e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              placeholder="e.g. no onions, extra spicy"
              aria-label={`Note for ${item.name}`}
              className={cn(inputClass, "h-9 text-label")}
            />
          ) : note ? (
            <button type="button" onClick={() => setEditing(true)} className="text-left text-small text-ink-700 hover:underline">
              “{note}” <span className="font-bold text-ember-700">Edit</span>
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="text-small font-bold text-ember-700 hover:underline">
              + Add a note for this dish
            </button>
          )}
        </div>
      )}
    </li>
  );
}

const SWEET_OR_DRINK = /dessert|sweet|drink|beverage|lassi|falooda|shake|juice|tea|coffee|soda|ice/i;

/** "Add to your order": a few dishes from other trucks or a sweet/drink to round it off. From the menu only. */
function Suggestions({ index, inCart, cartStalls }: { index: CatalogIndex; inCart: Set<string>; cartStalls: Set<string> }) {
  const live = useStallLive();
  const picks = useMemo(() => {
    const category = new Map(index.catalog.menu_categories.map((c) => [c.id, c.name]));
    return index.catalog.menu_items
      .filter((m) => !inCart.has(m.id) && m.is_available)
      .filter((m) => {
        const stall = index.stallById.get(m.stall_id);
        const status = live.status.get(m.stall_id);
        return stall?.is_active && stall.is_open && (status ? status.accepting : true);
      })
      .map((m) => ({
        m,
        score:
          (cartStalls.has(m.stall_id) ? 0 : 2) +
          (SWEET_OR_DRINK.test(`${category.get(m.category_id) ?? ""} ${m.name}`) ? 2 : 0) +
          (m.is_featured ? 1 : 0) +
          (m.image_url ? 0.5 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.m.sort_order - b.m.sort_order)
      .slice(0, 6)
      .map((x) => x.m);
  }, [index, inCart, cartStalls, live]);

  if (!picks.length) return null;
  return (
    <section aria-labelledby="suggest-heading">
      <h2 id="suggest-heading" className="text-heading">
        Add to your order
      </h2>
      <p className="mt-1 text-label text-ink-500">From the other trucks and the sweet side of the park.</p>
      <div className="scrollbar-none mt-3 -mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
        {picks.map((m) => (
          <DishCard key={m.id} item={m} stall={index.stallById.get(m.stall_id)!} showStall className="shrink-0" />
        ))}
      </div>
    </section>
  );
}

/** "As soon as possible" or a time later today, in 15-minute steps (park time). */
function PickupTime({ value, onChange, tz }: { value: string; onChange: (v: string) => void; tz: string }) {
  const now = useNow(60_000);
  const slots = useMemo(() => {
    const step = 15 * 60000;
    const first = Math.ceil((now + 20 * 60000) / step) * step;
    const today = parkDate(new Date(now), tz);
    const out: { iso: string; label: string }[] = [];
    for (let t = first; t <= now + 12 * 3600000 && out.length < 48; t += step) {
      const d = new Date(t);
      if (parkDate(d, tz) !== today) break;
      // Shown in the device's time like the rest of the site (customers are at the park).
      out.push({ iso: d.toISOString(), label: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
    }
    return out;
  }, [tz, now]);
  const later = Boolean(value);

  if (!slots.length) return null;
  return (
    <fieldset>
      <legend className="text-heading">When?</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Choice<"now" | "later">
          name="when"
          value="now"
          current={later ? "later" : "now"}
          onSelect={() => onChange("")}
          icon={<Timer className="size-4.5" aria-hidden />}
          title="As soon as possible"
          body="The trucks start as soon as the order goes through."
        />
        <Choice<"now" | "later">
          name="when"
          value="later"
          current={later ? "later" : "now"}
          onSelect={() => onChange(value || slots[0].iso)}
          icon={<Clock className="size-4.5" aria-hidden />}
          title="Later today"
          body="Pick a time; the trucks plan your order for it."
        />
      </div>
      {later && (
        <div className="mt-4 max-w-56">
          <Field label="Pickup time" htmlFor="pickup-time">
            <select id="pickup-time" className={inputClass} value={slots.some((s) => s.iso === value) ? value : ""} onChange={(e) => onChange(e.target.value)}>
              {!slots.some((s) => s.iso === value) && <option value="">Pick a time</option>}
              {slots.map((s) => (
                <option key={s.iso} value={s.iso}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </fieldset>
  );
}

