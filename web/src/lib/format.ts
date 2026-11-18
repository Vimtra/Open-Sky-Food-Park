import type { Coupon, Order, Park, StallOrder, TicketStatus } from "./types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** 899 -> "$8.99" */
export const money = (cents: number) => usd.format(cents / 100);

export interface Bill {
  item_total_cents: number;
  discount_cents: number;
  tax_cents: number;
  service_fee_cents: number;
  tip_cents: number;
  total_cents: number;
}

/** Client-side preview. Must match place_order in supabase/migrations/0001_init.sql. */
export function computeBill(itemTotalCents: number, park: Pick<Park, "tax_percent" | "service_fee_cents">, tipCents = 0, discountCents = 0): Bill {
  // The coupon comes off the item total before tax, as in place_order (0005_coupons.sql).
  const discount = Math.min(Math.max(0, discountCents), itemTotalCents);
  const tax = Math.round(((itemTotalCents - discount) * Number(park.tax_percent)) / 100);
  return {
    item_total_cents: itemTotalCents,
    discount_cents: discount,
    tax_cents: tax,
    service_fee_cents: park.service_fee_cents,
    tip_cents: tipCents,
    total_cents: itemTotalCents - discount + tax + park.service_fee_cents + tipCents,
  };
}

/** "10% off, up to $3.00" · "$2.00 off" */
export function couponValueLabel(c: Pick<Coupon, "kind" | "value" | "max_discount_cents">): string {
  if (c.kind === "percent") return `${c.value}% off${c.max_discount_cents ? `, up to ${money(c.max_discount_cents)}` : ""}`;
  return `${money(c.value)} off`;
}

/** The status the admin sees: Active, Scheduled, Expired, Used up or Off. */
export function couponStatus(c: Pick<Coupon, "is_active" | "starts_at" | "ends_at" | "usage_limit"> & { used?: number }, now = Date.now()) {
  if (!c.is_active) return "Off" as const;
  if (c.ends_at && new Date(c.ends_at).getTime() <= now) return "Expired" as const;
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return "Scheduled" as const;
  if (c.usage_limit != null && (c.used ?? 0) >= c.usage_limit) return "Used up" as const;
  return "Active" as const;
}

/** Local catalog images are stored as relative keys ("img/..."); uploaded ones are absolute URLs. */
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  // Uploaded photos are full URLs (Supabase Storage) or, in demo mode, data URLs kept in the browser.
  return /^(https?:\/\/|data:|blob:)/.test(url) ? url : `/${url.replace(/^\/+/, "")}`;
}

/** "Serves 4 | Paneer in a creamy tomato-butter gravy." or "12 oz | Chilled milk with rose syrup." Either half may be missing. */
export function dishBlurb(item: { serves: number | null; size_label?: string | null; description: string | null }): string | null {
  const amount = item.size_label?.trim() || (item.serves ? `Serves ${item.serves}` : null);
  const parts = [amount, item.description?.trim() || null].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function dayAndTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day}, ${timeOfDay(iso)}`;
}

export function minutesSince(iso: string | null, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export const ticketLabel: Record<TicketStatus, string> = {
  pending: "Waiting for payment",
  placed: "Sent to stall",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Collected",
  cancelled: "Cancelled",
};

/** What the customer should do or expect for one stall's part of the order. */
export function ticketGuidance(so: StallOrder, order: Pick<Order, "fulfilment" | "table_no">): string {
  const stall = so.stall?.name ?? "the stall";
  const table = order.fulfilment === "table";
  switch (so.status) {
    case "pending":
      return "We will send this to the stall once payment goes through.";
    case "placed":
      return `${stall} has your order and will start shortly.`;
    case "preparing":
      return table ? `Being prepared. It will be brought to table ${order.table_no}.` : "Being prepared. We will tell you when it is ready.";
    case "ready":
      return table ? `On its way to table ${order.table_no}.` : `Collect it at ${stall}. Show token ${so.token_no}.`;
    case "completed":
      return table ? "Served. Enjoy!" : "Collected. Enjoy!";
    case "cancelled":
      return `${stall} could not take this part of the order.`;
  }
}

export const isOrderLive = (o: Pick<Order, "status">) => o.status === "active" || o.status === "awaiting_payment";

/** Friendly text for the error codes raised by the database functions. */
const errorText: Record<string, string> = {
  coupons_disabled: "Coupons are switched off right now.",
  coupon_not_found: "That code doesn't exist. Check the spelling.",
  coupon_inactive: "That coupon is switched off.",
  coupon_not_started: "That coupon hasn't started yet.",
  coupon_expired: "That coupon has expired.",
  coupon_min_order: "Add a little more to use this coupon.",
  coupon_not_applicable: "This coupon is for a truck that isn't in your cart.",
  coupon_used_up: "That coupon has been fully used.",
  coupon_already_used: "You've already used this coupon.",
  login_taken: "That login email is already used by another account.",
  bad_login: "Wrong login or password.",
  contact_required: "Add an email or phone number so we can reply.",
  message_too_short: "Tell us a little more so we can help.",
  message_too_long: "That message is too long. Keep it under 2,000 characters.",
  too_many_messages: "You have sent several messages in the last hour. We will reply to those first.",
  sign_in_required: "Please sign in to place your order.",
  ordering_closed: "The park is not taking orders right now.",
  name_required: "Add your name so the stall knows whose order it is.",
  table_required: "Enter your table number.",
  table_service_unavailable: "Table service is off right now. Choose pickup instead.",
  cart_empty: "Your cart is empty.",
  item_not_found: "An item in your cart is no longer on the menu. Remove it and try again.",
  bad_quantity: "One of the quantities is not valid.",
  item_unavailable: "An item in your cart just sold out. Remove it and try again.",
  stall_closed: "A stall in your cart has closed. Remove its items and try again.",
  already_in_progress: "A stall has already started on this order, so it can no longer be cancelled.",
  not_found: "We could not find that order.",
  forbidden: "You do not have access to do that.",
  invalid_transition: "That order has already moved on. Refresh to see its current status.",
};

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const code = Object.keys(errorText).find((k) => raw.includes(k));
  if (code) return errorText[code];
  if (/failed to fetch|network/i.test(raw)) return "No connection. Check your signal and try again.";
  return raw || "Something went wrong. Please try again.";
}
