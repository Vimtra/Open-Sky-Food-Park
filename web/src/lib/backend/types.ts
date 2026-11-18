import type {
  Banner,
  Catalog,
  Coupon,
  CouponQuote,
  CouponWithUse,
  MenuCategory,
  MenuItem,
  Order,
  Park,
  PlaceOrderInput,
  PlaceOrderResult,
  Session,
  Stall,
  StallLogin,
  StallTicket,
  SupportRequest,
  SupportRequestInput,
  SupportStatus,
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
export type CouponInput = Partial<Coupon> & Pick<Coupon, "code" | "title" | "kind" | "value">;

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
  /**
   * Google sign-in. With Supabase this leaves the page for Google and comes back to
   * `returnTo` (a same-site path) signed in; in demo mode it signs in at once.
   */
  signInWithGoogle(area: Area, returnTo: string): Promise<void>;
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, code: string): Promise<Session>;
  signInWithPassword(email: string, password: string): Promise<Session>;
  /** Demo mode only: step into the admin panel without credentials. Stalls always sign in with their own login. */
  demoStaffSignIn(role: "admin"): Promise<Session>;
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

  // coupons
  /** Coupons the park lists under "Offers" (active, listed, not expired). */
  listOffers(): Promise<Coupon[]>;
  /** Checks a code against the cart and returns the discount, or throws a coupon_* error. */
  quoteCoupon(code: string, items: { menu_item_id: string; qty: number }[]): Promise<CouponQuote>;

  // help & support
  /** Sends a Contact us message. Works signed in or not. */
  submitSupportRequest(input: SupportRequestInput): Promise<{ id: string; ref_no: string }>;

  // admin
  listAllOrders(): Promise<Order[]>;
  listCoupons(): Promise<CouponWithUse[]>;
  saveCoupon(row: CouponInput): Promise<void>;
  deleteCoupon(id: string): Promise<void>;
  /** Uploads a photo (already resized in the browser) and returns the URL to store. */
  uploadImage(file: Blob, folder: "dishes" | "stalls" | "promos"): Promise<string>;
  /** One login per stall: stall staff sign in at /partner with it and see only their stall. */
  listStallLogins(): Promise<StallLogin[]>;
  setStallLogin(stallId: string, login: string, password: string): Promise<void>;
  listSupportRequests(): Promise<SupportRequest[]>;
  setSupportRequestStatus(id: string, status: SupportStatus): Promise<void>;
  onSupportChange(cb: () => void): Unsubscribe;
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
