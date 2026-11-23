"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Heart, LogOut, Receipt, RotateCcw, Store } from "lucide-react";
import { useState } from "react";
import { backend, formatPhone } from "@/lib/backend";
import { dayAndTime, isOrderLive, money, plural } from "@/lib/format";
import { useCatalog, useFavorites, useMyOrders, useSession } from "@/lib/hooks";
import { useOrderAgain } from "@/lib/reorder";
import { DishCard } from "./cards";
import type { Order } from "@/lib/types";
import { StatusPill } from "./order-screen";
import { CustomerSignIn } from "./sign-in";
import { Button, ButtonLink, Container, EmptyState, Field, inputClass, Notice } from "./ui";

/** Only same-site paths are accepted as a post-sign-in destination. */
const safeNext = (raw: string | null) => (raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null);

export function AccountScreen() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { session, isLoading } = useSession("customer");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileName = session?.profile.full_name ?? "";
  const [seededName, setSeededName] = useState("");
  if (seededName !== profileName) {
    setSeededName(profileName);
    setName(profileName);
  }

  if (isLoading) {
    return (
      <Container className="max-w-md py-10" aria-hidden>
        <div className="skeleton h-9 w-48" />
        <div className="skeleton mt-6 h-12" />
        <div className="skeleton mt-4 h-12" />
      </Container>
    );
  }

  if (!session) {
    return (
      <Container className="max-w-md py-8 md:py-14">
        <h1 className="text-title md:text-display">Sign in</h1>
        <p className="mt-2 text-ink-700">Sign in to place orders and see your tokens on any device.</p>
        <div className="mt-6">
          <CustomerSignIn returnTo={next ? `/account?next=${encodeURIComponent(next)}` : "/account"} onDone={() => next && router.replace(next)} />
        </div>
      </Container>
    );
  }

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await backend().updateProfile("customer", { full_name: name.trim() });
    setSaving(false);
    setSaved(true);
  };

  return (
    <Container className="max-w-md py-8 md:py-14">
      <h1 className="text-title md:text-display">Your account</h1>
      <p className="mt-1 font-medium text-ink-700 tabular-nums">{formatPhone(session.profile.phone) || session.email}</p>

      {next && (
        <Notice tone="success" className="mt-5">
          You are signed in.{" "}
          <Link href={next} className="font-bold underline">
            Continue where you left off
          </Link>
        </Notice>
      )}

      <form onSubmit={saveName} className="mt-6 space-y-3">
        <Field label="Name for your orders" htmlFor="account-name" hint={saved ? "Saved." : "Stalls call this out with your token."}>
          <input
            id="account-name"
            value={name}
            autoComplete="given-name"
            onChange={(e) => {
              setName(e.target.value.slice(0, 60));
              setSaved(false);
            }}
            className={inputClass}
          />
        </Field>
        <Button type="submit" variant="outline" loading={saving} disabled={!name.trim() || name.trim() === profileName}>
          Save name
        </Button>
      </form>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        <li>
          <Link href="/orders" className="flex h-14 items-center gap-3 font-bold hover:text-ember-700">
            <Receipt className="size-5 text-ink-700" aria-hidden />
            <span className="flex-1">Your orders</span>
            <ChevronRight className="size-5 text-ink-500" aria-hidden />
          </Link>
        </li>
        <li>
          <Link href="/partner" className="flex h-14 items-center gap-3 font-bold hover:text-ember-700">
            <Store className="size-5 text-ink-700" aria-hidden />
            <span className="flex-1">Stall dashboard</span>
            <ChevronRight className="size-5 text-ink-500" aria-hidden />
          </Link>
        </li>
      </ul>

      <Favourites />

      <Button variant="ghost" className="mt-6 -ml-3" onClick={() => backend().signOut("customer")}>
        <LogOut className="size-4.5" aria-hidden />
        Sign out
      </Button>
    </Container>
  );
}

function OrderRow({ order }: { order: Order }) {
  const live = isOrderLive(order);
  const itemCount = order.stall_orders.reduce((n, s) => n + s.order_items.reduce((m, i) => m + i.qty, 0), 0);
  return (
    <li>
      <Link href={`/orders/${order.id}`} className="group block rounded-lg border border-line p-4 transition-colors duration-150 hover:bg-surface-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1.0625rem] leading-6 font-extrabold group-hover:underline">{order.stall_orders.map((s) => s.stall?.name ?? "Stall").join(" + ")}</p>
            <p className="mt-0.5 text-small text-ink-500">
              <span className="tabular-nums">{order.order_no}</span> · {dayAndTime(order.created_at)} · {plural(itemCount, "item")}
            </p>
          </div>
          <p className="shrink-0 font-bold tabular-nums">{money(order.total_cents)}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "awaiting_payment" ? (
            <span className="inline-flex h-6 items-center rounded-full bg-ember-100 px-2.5 text-caption font-bold text-ember-700">Payment needed</span>
          ) : (
            order.stall_orders.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 text-small font-semibold text-ink-700">
                {live && <span className="rounded-xs bg-night-900 px-1.5 py-0.5 text-caption font-bold text-white tabular-nums">Token {s.token_no}</span>}
                <StatusPill status={s.status} />
              </span>
            ))
          )}
        </div>
      </Link>
      {!live && <OrderAgainButton order={order} />}
    </li>
  );
}

function OrderAgainButton({ order }: { order: Order }) {
  const orderAgain = useOrderAgain();
  const router = useRouter();
  const [skipped, setSkipped] = useState<string[] | null>(null);
  return (
    <div className="mt-1.5 px-1">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 text-label font-bold text-ember-700 hover:underline"
        onClick={() => {
          const r = orderAgain(order);
          if (r.added && !r.skipped.length) router.push("/cart");
          else setSkipped(r.skipped.length ? r.skipped : ["nothing from this order is available right now"]);
        }}
      >
        <RotateCcw className="size-4" aria-hidden /> Order again
      </button>
      {skipped && (
        <p className="text-small text-ink-700" role="status">
          Not added: {skipped.join("; ")}.{" "}
          <Link href="/cart" className="font-bold text-ember-700 underline">
            Go to cart
          </Link>
        </p>
      )}
    </div>
  );
}

/** Saved dishes and trucks (contract v1.6 favourites). */
function Favourites() {
  const fav = useFavorites();
  const { index } = useCatalog();
  if (!index) return null;
  const dishes = fav.list.flatMap((f) => (f.menu_item_id ? [index.itemById.get(f.menu_item_id)] : [])).filter((m) => m !== undefined);
  const trucks = fav.list.flatMap((f) => (f.stall_id ? [index.stallById.get(f.stall_id)] : [])).filter((s) => s !== undefined && s.is_active);
  return (
    <section className="mt-8" aria-labelledby="fav-heading">
      <h2 id="fav-heading" className="flex items-center gap-2 text-heading">
        <Heart className="size-5 text-chili-600" aria-hidden /> Favourites
      </h2>
      {!dishes.length && !trucks.length ? (
        <p className="mt-2 text-label text-ink-500">Tap the heart on a dish or a truck to keep it here.</p>
      ) : (
        <>
          {trucks.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {trucks.map((t) => (
                <li key={t!.id}>
                  <Link href={`/stall/${t!.slug}`} className="inline-flex h-9 items-center rounded-full border border-line px-3 text-label font-bold hover:bg-surface-1">
                    {t!.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {dishes.length > 0 && (
            <div className="scrollbar-none mt-3 -mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
              {dishes.map((m) => (
                <DishCard key={m!.id} item={m!} stall={index.stallById.get(m!.stall_id)!} showStall className="shrink-0" />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function OrdersScreen() {
  const { session, isLoading: sessionLoading } = useSession("customer");
  const { orders, error } = useMyOrders(Boolean(session));

  if (sessionLoading || (session && !orders && !error)) {
    return (
      <Container className="max-w-[720px] py-8" aria-hidden>
        <div className="skeleton h-9 w-48" />
        <div className="skeleton mt-6 h-28 rounded-lg" />
        <div className="skeleton mt-3 h-28 rounded-lg" />
      </Container>
    );
  }

  if (!session) {
    return (
      <EmptyState
        icon={<Receipt className="size-7" aria-hidden />}
        title="Sign in to see your orders"
        body="Your tokens and past orders are saved to your account."
        action={<ButtonLink href="/account?next=/orders">Sign in</ButtonLink>}
      />
    );
  }

  if (error && !orders) {
    return (
      <Container className="max-w-[720px] py-8">
        <Notice tone="error">We could not load your orders. Check your connection and refresh.</Notice>
      </Container>
    );
  }

  if (!orders?.length) {
    return (
      <EmptyState
        icon={<Receipt className="size-7" aria-hidden />}
        title="No orders yet"
        body="When you order, your token numbers show up here."
        action={<ButtonLink href="/">Browse the food trucks</ButtonLink>}
      />
    );
  }

  const live = orders.filter(isOrderLive);
  const past = orders.filter((o) => !isOrderLive(o));

  return (
    <Container className="max-w-[720px] py-5 md:py-8">
      <h1 className="text-title md:text-display">Your orders</h1>
      {live.length > 0 && (
        <section className="mt-6" aria-labelledby="live-orders">
          <h2 id="live-orders" className="text-heading">
            In progress
          </h2>
          <ul className="mt-3 space-y-3">
            {live.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="mt-8" aria-labelledby="past-orders">
          <h2 id="past-orders" className="text-heading">
            Past orders
          </h2>
          <ul className="mt-3 space-y-3">
            {past.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
