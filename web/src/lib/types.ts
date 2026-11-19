// Mirrors supabase/migrations/0001_init.sql (contract version 1).
// Field names match the database columns exactly, so rows from Supabase and rows from
// shared/seed/catalog.json have the same shape.

export type Diet = "veg" | "egg" | "nonveg";
export type Fulfilment = "pickup" | "table";
export type PaymentMethod = "online" | "pay_at_stall";
export type PaymentStatus = "unpaid" | "paid" | "refunded";
export type OrderStatus = "awaiting_payment" | "active" | "completed" | "cancelled";
export type TicketStatus = "pending" | "placed" | "preparing" | "ready" | "completed" | "cancelled";
export type UserRole = "customer" | "stall_staff" | "admin";

export interface Park {
  id: number;
  name: string;
  tagline: string | null;
  address: string | null;
  timezone: string;
  instagram: string | null;
  logo_url: string | null;
  tax_percent: number;
  service_fee_cents: number;
  ordering_enabled: boolean;
  table_service_enabled: boolean;
  announcement: string | null;
  /** Park contact details. Shown on /contact and /help only when set. */
  contact_email: string | null;
  contact_phone: string | null;
  /** Free text, e.g. "Thu–Sun, 5–11 PM". */
  hours_text: string | null;
  /** Master switch for the coupon box at checkout. */
  coupons_enabled: boolean;
  /** v1.6: customers may pick a pickup time later today. */
  scheduled_orders_enabled?: boolean;
  /** v1.6: average stars shown to everyone (otherwise only to staff). */
  ratings_public?: boolean;
}

export interface Stall {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  cuisines: string[];
  location_label: string | null;
  phone: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_veg_only: boolean;
  avg_prep_mins: number | null;
  is_open: boolean;
  is_active: boolean;
  sort_order: number;
  /** v1.6: opening hours (`stall_hours`) open and close ordering by themselves. */
  auto_hours?: boolean;
  /** v1.6: no new orders until this time (ISO), set by the truck. */
  paused_until?: string | null;
}

/** v1.6 · weekday 0 = Sunday; "HH:MM" in the park's time zone. closes < opens means past midnight. */
export interface StallHours {
  id?: string;
  stall_id: string;
  weekday: number;
  opens: string;
  closes: string;
}

/** v1.6 · a group of choices on a dish: min 1 / max 1 is a required single pick (a size). */
export interface MenuOptionGroup {
  id: string;
  menu_item_id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
}

export interface MenuOption {
  id: string;
  group_id: string;
  name: string;
  /** Added to the dish price. */
  price_cents: number;
  is_default: boolean;
  is_available: boolean;
  sort_order: number;
}

/** Copy of a chosen option kept on the order line. */
export interface ChosenOption {
  group: string;
  name: string;
  price_cents: number;
}

export interface MenuCategory {
  id: string;
  stall_id: string;
  name: string;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  stall_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  diet: Diet | null;
  image_url: string | null;
  craving: string | null;
  is_available: boolean;
  is_featured: boolean;
  /** How many people the dish serves. Null hides it. */
  serves: number | null;
  /** Cup or portion size, e.g. "12 oz". Shown instead of "Serves N" when set. */
  size_label: string | null;
  sort_order: number;
}

export interface Craving {
  slug: string;
  name: string;
  image_url: string | null;
  sort_order: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  stall_id: string | null;
  menu_item_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Catalog {
  park: Park;
  cravings: Craving[];
  banners: Banner[];
  stalls: Stall[];
  menu_categories: MenuCategory[];
  menu_items: MenuItem[];
  /** v1.6 */
  stall_hours?: StallHours[];
  menu_option_groups?: MenuOptionGroup[];
  menu_options?: MenuOption[];
  /** Seed only: items whose price the owner has not confirmed. */
  placeholder_price_item_ids?: string[];
}

export interface OrderItem {
  id: string;
  stall_order_id: string;
  menu_item_id: string | null;
  name: string;
  diet: Diet | null;
  unit_price_cents: number;
  qty: number;
  note: string | null;
  /** v1.6: options chosen; `unit_price_cents` already includes their prices. */
  options?: ChosenOption[];
}

export type StallSummary = Pick<Stall, "id" | "slug" | "name" | "location_label" | "logo_url" | "phone">;

export interface StallOrder {
  id: string;
  order_id: string;
  stall_id: string;
  token_no: number;
  status: TicketStatus;
  subtotal_cents: number;
  /** This stall's share of the order's coupon discount. The shares add up to `orders.discount_cents`. */
  discount_cents: number;
  /** This stall's share of the order's tax. The shares add up to `orders.tax_cents`. */
  tax_cents: number;
  created_at: string;
  placed_at: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  /** v1.6: minutes the truck said when accepting, and when that runs out. */
  prep_mins?: number | null;
  ready_by?: string | null;
  refunded_cents?: number;
  order_items: OrderItem[];
  stall: StallSummary | null;
}

export interface Order {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  fulfilment: Fulfilment;
  table_no: string | null;
  note: string | null;
  item_total_cents: number;
  /** Coupon applied at checkout, if any, and the amount it took off the item total (before tax). */
  coupon_id?: string | null;
  coupon_code: string | null;
  discount_cents: number;
  tax_cents: number;
  service_fee_cents: number;
  tip_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  created_at: string;
  /** v1.6: pickup later today, or null for as soon as possible. */
  pickup_at?: string | null;
  refunded_cents?: number;
  stall_orders: StallOrder[];
}

/** A stall order as the stall dashboard sees it, with the parent order's customer details. */
export interface StallTicket extends StallOrder {
  order: Pick<
    Order,
    "id" | "order_no" | "customer_name" | "customer_phone" | "fulfilment" | "table_no" | "note" | "payment_method" | "payment_status"
  >;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
}

export interface Session {
  user_id: string;
  profile: Profile;
  /** Stalls this user may run. Admins get every stall. */
  staff_stall_ids: string[];
  email: string | null;
}

export interface PlaceOrderInput {
  fulfilment: Fulfilment;
  table_no: string | null;
  customer_name: string;
  customer_phone: string | null;
  note: string | null;
  payment_method: PaymentMethod;
  tip_cents: number;
  coupon_code?: string | null;
  /** v1.6: ISO time later today. */
  pickup_at?: string | null;
  items: { menu_item_id: string; qty: number; note?: string | null; option_ids?: string[] }[];
}

export interface PlaceOrderResult {
  order_id: string;
  order_no: string;
  total_cents: number;
}

export type SupportTopic = "order" | "feedback" | "lost_found" | "vendor" | "other";
export type SupportStatus = "new" | "in_progress" | "closed";

export interface SupportRequest {
  id: string;
  ref_no: string;
  customer_id: string | null;
  name: string;
  /** Email or phone number, as typed. */
  contact: string;
  topic: SupportTopic;
  order_no: string | null;
  message: string;
  status: SupportStatus;
  created_at: string;
  handled_at: string | null;
}

export interface SupportRequestInput {
  name: string;
  contact: string;
  topic: SupportTopic;
  order_no: string | null;
  message: string;
}

export type CouponKind = "percent" | "amount";

export interface Coupon {
  id: string;
  /** Upper case, 3–24 letters, digits, - or _. */
  code: string;
  title: string;
  description: string | null;
  kind: CouponKind;
  /** percent: 1–100 · amount: cents off. */
  value: number;
  min_order_cents: number;
  max_discount_cents: number | null;
  /** null = every truck; otherwise only that truck's dishes count and get the discount. */
  stall_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  is_active: boolean;
  /** Listed under "Offers" at checkout. Hidden codes work only when typed in. */
  show_in_app: boolean;
  created_at: string;
}

/** Admin view of a coupon: how many orders used it (cancelled orders do not count). */
export interface CouponWithUse extends Coupon {
  used: number;
}

export interface CouponQuote {
  code: string;
  title: string;
  stall_id: string | null;
  discount_cents: number;
}

/** The sign-in a stall's staff use on /partner. One per stall. */
export interface StallLogin {
  stall_id: string;
  login: string | null;
}

// ---------------------------------------------------------------- contract v1.6

export interface Favorite {
  user_id: string;
  menu_item_id: string | null;
  stall_id: string | null;
  created_at: string;
}

export interface OrderRating {
  id: string;
  stall_order_id: string;
  order_id: string;
  stall_id: string;
  customer_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export type RefundStatus = "pending" | "succeeded" | "failed";

export interface Refund {
  id: string;
  order_id: string;
  stall_order_id: string | null;
  amount_cents: number;
  reason: string;
  status: RefundStatus;
  stripe_refund_id: string | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
}

/** `stall_status()`: reason is "closed" | "paused" | "outside_hours" when not accepting. */
export interface StallStatus {
  stall_id: string;
  accepting: boolean;
  reason: "closed" | "paused" | "outside_hours" | null;
  paused_until: string | null;
}

/** `stall_wait_times()`: typical_prep_mins is null until there are enough real tickets. */
export interface StallWait {
  stall_id: string;
  open_tickets: number;
  typical_prep_mins: number | null;
}

/** `report_sales()`: charged = items − discount + tax, what the truck collects. */
export interface SalesRow {
  day: string;
  stall_id: string;
  orders: number;
  items: number;
  item_cents: number;
  discount_cents: number;
  tax_cents: number;
  charged_cents: number;
  online_cents: number;
  at_stall_cents: number;
  refunded_cents: number;
}

export interface ItemSalesRow {
  stall_id: string;
  menu_item_id: string | null;
  name: string;
  qty: number;
  sales_cents: number;
}

export interface HourRow {
  weekday: number;
  hour: number;
  orders: number;
}
