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
}

export type StallSummary = Pick<Stall, "id" | "slug" | "name" | "location_label" | "logo_url" | "phone">;

export interface StallOrder {
  id: string;
  order_id: string;
  stall_id: string;
  token_no: number;
  status: TicketStatus;
  subtotal_cents: number;
  /** This stall's share of the order's tax. The shares add up to `orders.tax_cents`. */
  tax_cents: number;
  created_at: string;
  placed_at: string | null;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
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
  tax_cents: number;
  service_fee_cents: number;
  tip_cents: number;
  total_cents: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  created_at: string;
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
  items: { menu_item_id: string; qty: number; note?: string | null }[];
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
