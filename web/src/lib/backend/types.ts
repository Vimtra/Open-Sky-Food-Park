import type {
  Banner,
  Catalog,
  MenuCategory,
  MenuItem,
  Order,
  Park,
  PlaceOrderInput,
  PlaceOrderResult,
  Session,
  Stall,
  StallTicket,
  TicketStatus,
} from "../types";

export type Unsubscribe = () => void;

/**
 * Which sign-in the caller means. The customer site and the stall/admin tools keep
 * separate sessions in demo mode so both can be open side by side in one browser.
 * With Supabase there is a single auth session and both areas return it.
 */
export type Area = "customer" | "staff";

export type PaymentStart =
  | { kind: "demo" }
  | { kind: "stripe"; client_secret: string; publishable_key: string };

/** Rows saved from the admin panel. Omit `id` to create. */
export type StallInput = Partial<Stall> & Pick<Stall, "name">;
export type CategoryInput = Partial<MenuCategory> & Pick<MenuCategory, "stall_id" | "name">;
export type ItemInput = Partial<MenuItem> & Pick<MenuItem, "stall_id" | "category_id" | "name" | "price_cents">;
export type BannerInput = Partial<Banner> & Pick<Banner, "title">;

/**
 * Everything the UI needs from the data layer. Two implementations:
 *  - demo.ts: seed catalog + localStorage, no network
 *  - supabase.ts: the shared database (see supabase/migrations)
 */
export interface Backend {
  readonly mode: "demo" | "supabase";

  // catalog
  getCatalog(): Promise<Catalog>;
  onCatalogChange(cb: () => void): Unsubscribe;

  // sign-in
  getSession(area: Area): Promise<Session | null>;
  onSessionChange(cb: () => void): Unsubscribe;
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<Session>;
  signInWithPassword(email: string, password: string): Promise<Session>;
  /** Demo mode only: step into a stall or the admin panel without credentials. */
  demoStaffSignIn(role: "stall_staff" | "admin", stallId?: string): Promise<Session>;
  updateProfile(area: Area, patch: { full_name: string }): Promise<void>;
  signOut(area: Area): Promise<void>;

  // customer orders
  placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult>;
  listMyOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  onOrdersChange(cb: () => void): Unsubscribe;
  cancelOrder(id: string): Promise<void>;
  startPayment(orderId: string): Promise<PaymentStart>;
  /** Demo mode only: stands in for the payment provider confirming the charge. */
  confirmDemoPayment(orderId: string): Promise<void>;

  // stall staff
  listStallTickets(stallId: string): Promise<StallTicket[]>;
  setStallOrderStatus(stallOrderId: string, status: TicketStatus): Promise<void>;
  setItemAvailable(itemId: string, available: boolean): Promise<void>;
  setStallOpen(stallId: string, open: boolean): Promise<void>;

  // admin
  listAllOrders(): Promise<Order[]>;
  saveStall(row: StallInput): Promise<void>;
  deleteStall(id: string): Promise<void>;
  saveCategory(row: CategoryInput): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  saveItem(row: ItemInput): Promise<void>;
  deleteItem(id: string): Promise<void>;
  saveBanner(row: BannerInput): Promise<void>;
  deleteBanner(id: string): Promise<void>;
  saveSettings(patch: Partial<Park>): Promise<void>;
  /** Demo mode only: wipe local orders and edits back to the seed catalog. */
  resetDemo(): Promise<void>;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "(408) 555-0101" -> "+14085550101". Returns null when it is not a usable number. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** "+14085550101" -> "(408) 555-0101" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
