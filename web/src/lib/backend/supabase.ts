// Supabase backend: the shared database used by the website and the Flutter apps.
// Schema, security rules and the rpc functions called here live in supabase/migrations.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { addDays, parkDate } from "../reports";
import type {
  Catalog,
  Coupon,
  CouponWithUse,
  Favorite,
  HourRow,
  ItemSalesRow,
  Order,
  OrderRating,
  Park,
  PopularItem,
  Profile,
  RatingSummary,
  Refund,
  SalesRow,
  Session,
  StallLogin,
  StallStatus,
  StallTicket,
  StallWait,
  SupportRequest,
} from "../types";
import { filterOrders, slugify, type Backend, type Unsubscribe } from "./types";

const STALL_SUMMARY = "id,slug,name,location_label,logo_url,phone";
const ORDER_SELECT = `*, stall_orders(*, order_items(*), stall:stalls(${STALL_SUMMARY}))`;
const TICKET_SELECT = `*, order_items(*), stall:stalls(${STALL_SUMMARY}), order:orders(id,order_no,customer_name,customer_phone,fulfilment,table_no,note,payment_method,payment_status)`;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

function check(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}

const sortOrders = (orders: Order[]) => {
  orders.forEach((o) => o.stall_orders?.sort((a, b) => a.stall_id.localeCompare(b.stall_id)));
  return orders;
};

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const db: SupabaseClient = createClient(url, anonKey, {
    // PKCE: Google sends the visitor back with ?code=, which the client swaps for a session on load.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });

  let channelSeq = 0;
  /** Calls `cb` whenever any of the given tables change. Callers refetch; nothing is patched in place. */
  const watch = (tables: string[], cb: () => void): Unsubscribe => {
    let channel = db.channel(`osfp-${tables.join("-")}-${++channelSeq}`);
    for (const table of tables) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, cb);
    }
    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  };

  const loadSession = async (): Promise<Session | null> => {
    const { data } = await db.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const profile =
      (unwrap(await db.from("profiles").select("id,full_name,phone,role").eq("id", user.id).maybeSingle()) as Profile | null) ??
      ({ id: user.id, full_name: null, phone: user.phone ?? null, role: "customer" } satisfies Profile);
    let stallIds: string[] = [];
    if (profile.role === "admin") {
      stallIds = (unwrap(await db.from("stalls").select("id")) as { id: string }[]).map((s) => s.id);
    } else if (profile.role === "stall_staff") {
      stallIds = (unwrap(await db.from("stall_staff").select("stall_id").eq("user_id", user.id)) as { stall_id: string }[]).map(
        (s) => s.stall_id,
      );
    }
    return { user_id: user.id, profile, staff_stall_ids: stallIds, email: user.email ?? null };
  };

  /** Calls /api/admin/stall-logins as the signed-in admin. */
  const adminApi = (method: "GET" | "POST", body?: unknown) => serverApi("/api/admin/stall-logins", method, body);

  /** Calls one of this site's server routes with the signed-in user's token. */
  const serverApi = async (path: string, method: "GET" | "POST", body?: unknown) => {
    const { data } = await db.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("sign_in_required");
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "The server did not accept that.");
    return json;
  };

  const requireSession = async () => {
    const session = await loadSession();
    if (!session) throw new Error("sign_in_required");
    return session;
  };

  const upsert = async (table: string, row: Record<string, unknown>) => {
    const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
    check(await db.from(table).upsert(clean));
  };

  return {
    mode: "supabase",

    async getCatalog() {
      const [park, cravings, banners, stalls, categories, items, groups, options, hours] = await Promise.all([
        db.from("park_settings").select("*").eq("id", 1).single(),
        db.from("cravings").select("*").order("sort_order"),
        db.from("banners").select("*").order("sort_order"),
        db.from("stalls").select("*").order("sort_order"),
        db.from("menu_categories").select("*").order("sort_order"),
        db.from("menu_items").select("*").order("sort_order"),
        db.from("menu_option_groups").select("*").order("sort_order"),
        db.from("menu_options").select("*").order("sort_order"),
        db.from("stall_hours").select("*"),
      ]);
      const parkRow = unwrap(park) as Park;
      return {
        park: { ...parkRow, tax_percent: Number(parkRow.tax_percent) },
        cravings: unwrap(cravings),
        banners: unwrap(banners),
        stalls: unwrap(stalls),
        menu_categories: unwrap(categories),
        menu_items: unwrap(items),
        menu_option_groups: unwrap(groups),
        menu_options: unwrap(options),
        stall_hours: (unwrap(hours) as { opens: string; closes: string }[]).map((h) => ({ ...h, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) })),
      } as Catalog;
    },

    onCatalogChange: (cb) => watch(["menu_items", "stalls"], cb),

    async listFavorites() {
      const { data } = await db.auth.getSession();
      if (!data.session) return [];
      return unwrap(await db.from("favorites").select("*").order("created_at", { ascending: false })) as Favorite[];
    },

    async setFavorite(target, on) {
      const session = await requireSession();
      const col = target.menu_item_id ? "menu_item_id" : "stall_id";
      const id = target.menu_item_id ?? target.stall_id!;
      if (on) {
        const { error } = await db.from("favorites").insert({ user_id: session.user_id, [col]: id });
        // already saved is fine
        if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
      } else {
        check(await db.from("favorites").delete().eq("user_id", session.user_id).eq(col, id));
      }
    },

    async listMyRatings(orderId) {
      return unwrap(await db.from("order_ratings").select("*").eq("order_id", orderId)) as OrderRating[];
    },

    async rateStallOrder(stallOrderId, stars, comment) {
      check(await db.rpc("rate_stall_order", { p_stall_order_id: stallOrderId, p_stars: stars, p_comment: comment }));
    },

    async getRatingSummary() {
      const rows = unwrap(await db.rpc("stall_rating_summary")) as RatingSummary[];
      return rows.map((r) => ({ ...r, avg_stars: Number(r.avg_stars) }));
    },

    async getStallStatus() {
      return unwrap(await db.rpc("stall_status")) as StallStatus[];
    },

    async getWaitTimes() {
      return unwrap(await db.rpc("stall_wait_times")) as StallWait[];
    },

    async popularItems(limit = 8) {
      return unwrap(await db.rpc("popular_items", { p_limit: limit })) as PopularItem[];
    },

    async saveItemOptions(itemId, groups) {
      // Keep ids that still exist (carts refer to them); remove the rest; add new ones.
      const existing = unwrap(await db.from("menu_option_groups").select("id").eq("menu_item_id", itemId)) as { id: string }[];
      const keep = new Set(groups.map((g) => g.id).filter(Boolean));
      const drop = existing.map((g) => g.id).filter((id) => !keep.has(id));
      if (drop.length) check(await db.from("menu_option_groups").delete().in("id", drop));
      for (const [gi, g] of groups.entries()) {
        const groupRow = { menu_item_id: itemId, name: g.name, min_select: g.min_select, max_select: g.max_select, sort_order: gi };
        const saved = unwrap(
          await (g.id ? db.from("menu_option_groups").update(groupRow).eq("id", g.id).select("id").single() : db.from("menu_option_groups").insert(groupRow).select("id").single()),
        ) as { id: string };
        const have = unwrap(await db.from("menu_options").select("id").eq("group_id", saved.id)) as { id: string }[];
        const keepOpts = new Set(g.options.map((o) => o.id).filter(Boolean));
        const dropOpts = have.map((o) => o.id).filter((id) => !keepOpts.has(id));
        if (dropOpts.length) check(await db.from("menu_options").delete().in("id", dropOpts));
        for (const [oi, o] of g.options.entries()) {
          const row = { group_id: saved.id, name: o.name, price_cents: o.price_cents, is_default: o.is_default, is_available: o.is_available, sort_order: oi };
          check(await (o.id ? db.from("menu_options").update(row).eq("id", o.id) : db.from("menu_options").insert(row)));
        }
      }
    },

    getSession: () => loadSession(),

    onSessionChange(cb) {
      const { data } = db.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    async requestOtp(phone) {
      check(await db.auth.signInWithOtp({ phone }));
    },

    async verifyOtp(phone, code) {
      check(await db.auth.verifyOtp({ phone, token: code, type: "sms" }));
      return requireSession();
    },

    async signInWithGoogle(_area, returnTo) {
      const path = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account";
      check(
        await db.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}${path}`, queryParams: { prompt: "select_account" } },
        }),
      );
    },

    async signInWithPassword(email, password) {
      check(await db.auth.signInWithPassword({ email, password }));
      return requireSession();
    },

    async demoStaffSignIn() {
      throw new Error("Demo sign-in is only available in demo mode.");
    },

    async updateProfile(_area, patch) {
      const session = await requireSession();
      check(await db.from("profiles").update({ full_name: patch.full_name }).eq("id", session.user_id));
    },

    async signOut() {
      check(await db.auth.signOut());
    },

    // ---------------------------------------------------------------- customer orders
    async placeOrder(input) {
      return unwrap(await db.rpc("place_order", { payload: input }));
    },

    async listMyOrders() {
      const session = await loadSession();
      if (!session) return [];
      return sortOrders(
        unwrap(
          await db
            .from("orders")
            .select(ORDER_SELECT)
            .eq("customer_id", session.user_id)
            .order("created_at", { ascending: false })
            .limit(50),
        ) as Order[],
      );
    },

    async getOrder(id) {
      const order = unwrap(await db.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle()) as Order | null;
      return order ? sortOrders([order])[0] : null;
    },

    onOrdersChange: (cb) => watch(["orders", "stall_orders"], cb),

    async cancelOrder(id) {
      check(await db.rpc("cancel_order", { p_order_id: id }));
    },

    async startPayment(orderId) {
      const { data } = await db.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("sign_in_required");
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not start the payment.");
      return { kind: "stripe", client_secret: body.client_secret, publishable_key: body.publishable_key };
    },

    async checkPayment(orderId, paymentIntentId) {
      const { data } = await db.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("sign_in_required");
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId, payment_intent: paymentIntentId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not check the payment.");
      return body.status;
    },

    async confirmDemoPayment() {
      throw new Error("Demo payment is only available in demo mode.");
    },

    // ---------------------------------------------------------------- stall staff
    async listStallTickets(stallId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      return unwrap(
        await db
          .from("stall_orders")
          .select(TICKET_SELECT)
          .eq("stall_id", stallId)
          .neq("status", "pending")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(300),
      ) as StallTicket[];
    },

    async setStallOrderStatus(stallOrderId, status, prepMins) {
      check(
        await db.rpc("set_stall_order_status", {
          p_stall_order_id: stallOrderId,
          p_status: status,
          ...(prepMins !== undefined ? { p_prep_mins: prepMins } : {}),
        }),
      );
    },

    async setItemAvailable(itemId, available) {
      check(await db.rpc("set_item_available", { p_item_id: itemId, p_available: available }));
    },

    async setStallOpen(stallId, open) {
      check(await db.rpc("set_stall_open", { p_stall_id: stallId, p_open: open }));
    },

    // ---------------------------------------------------------------- admin
    async listAllOrders() {
      return sortOrders(
        unwrap(await db.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(200)) as Order[],
      );
    },

    async searchOrders(filter) {
      let q = db.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(500);
      // A day of slack either side of the park dates; filterOrders() then applies the exact park-time rules.
      if (filter.from) q = q.gte("created_at", `${addDays(filter.from, -1)}T00:00:00Z`);
      if (filter.to) q = q.lt("created_at", `${addDays(filter.to, 2)}T00:00:00Z`);
      if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
      if (filter.payment === "online" || filter.payment === "pay_at_stall") q = q.eq("payment_method", filter.payment);
      if (filter.payment === "refunds") q = q.gt("refunded_cents", 0);
      const text = (filter.text ?? "").trim().replace(/[^\p{L}\p{N} +#-]/gu, "");
      const digits = text.replace(/\D/g, "");
      if (text && !text.startsWith("#")) {
        const ors = [`order_no.ilike.%${text}%`, `customer_name.ilike.%${text}%`];
        if (digits.length >= 3) ors.push(`customer_phone.ilike.%${digits}%`);
        q = q.or(ors.join(","));
      }
      const orders = sortOrders(unwrap(await q) as Order[]);
      return filterOrders(orders, filter, (iso) => parkDate(iso));
    },

    async listRefunds(orderId) {
      let q = db.from("refunds").select("*").order("created_at", { ascending: false }).limit(200);
      if (orderId) q = q.eq("order_id", orderId);
      return unwrap(await q) as Refund[];
    },

    async requestRefund(orderId, stallOrderId, amountCents, reason) {
      const id = unwrap(
        await db.rpc("request_refund", { p_order_id: orderId, p_stall_order_id: stallOrderId, p_amount_cents: amountCents, p_reason: reason }),
      ) as string;
      const result = await serverApi("/api/payments/refunds", "POST", { refund_id: id });
      if (result.failed > 0) throw new Error(result.errors?.[0] ?? "Stripe did not accept the refund.");
    },

    async processRefunds() {
      const result = await serverApi("/api/payments/refunds", "POST", {});
      return { sent: result.sent ?? 0, failed: result.failed ?? 0 };
    },

    async reportSales(from, to, stallId = null) {
      return unwrap(await db.rpc("report_sales", { p_from: from, p_to: to, p_stall_id: stallId })) as SalesRow[];
    },

    async reportItems(from, to, stallId = null) {
      return unwrap(await db.rpc("report_items", { p_from: from, p_to: to, p_stall_id: stallId })) as ItemSalesRow[];
    },

    async reportHours(from, to, stallId = null) {
      return unwrap(await db.rpc("report_hours", { p_from: from, p_to: to, p_stall_id: stallId })) as HourRow[];
    },

    async saveStall(row) {
      const slug = row.slug || slugify(row.name);
      await upsert("stalls", { ...row, slug, id: row.id ?? slug });
    },
    async deleteStall(id) {
      check(await db.from("stalls").delete().eq("id", id));
    },
    saveCategory: (row) => upsert("menu_categories", row),
    async deleteCategory(id) {
      check(await db.from("menu_categories").delete().eq("id", id));
    },
    saveItem: (row) => upsert("menu_items", row),
    async deleteItem(id) {
      check(await db.from("menu_items").delete().eq("id", id));
    },
    saveBanner: (row) => upsert("banners", row),
    async deleteBanner(id) {
      check(await db.from("banners").delete().eq("id", id));
    },
    async saveSettings(patch) {
      const { id: _id, ...rest } = patch;
      void _id;
      check(await db.from("park_settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1));
    },

    // ---------------------------------------------------------------- help & support
    async submitSupportRequest(input) {
      return unwrap(await db.rpc("submit_support_request", { payload: input }));
    },

    async listSupportRequests() {
      return unwrap(await db.from("support_requests").select("*").order("created_at", { ascending: false }).limit(300)) as SupportRequest[];
    },

    async setSupportRequestStatus(id, status) {
      check(
        await db
          .from("support_requests")
          .update({ status, handled_at: status === "new" ? null : new Date().toISOString() })
          .eq("id", id),
      );
    },

    onSupportChange: (cb) => watch(["support_requests"], cb),

    // ---------------------------------------------------------------- coupons
    async listOffers() {
      const rows = unwrap(await db.from("coupons").select("*").eq("is_active", true).eq("show_in_app", true).order("created_at")) as Coupon[];
      const nowMs = Date.now();
      return rows.filter((c) => !c.ends_at || new Date(c.ends_at).getTime() > nowMs);
    },

    async quoteCoupon(code, items) {
      return unwrap(await db.rpc("quote_coupon", { p_code: code, p_items: items }));
    },

    async listCoupons() {
      const [coupons, uses] = await Promise.all([
        db.from("coupons").select("*").order("created_at", { ascending: false }),
        db.from("orders").select("coupon_id").not("coupon_id", "is", null).neq("status", "cancelled").limit(10000),
      ]);
      const count = new Map<string, number>();
      for (const r of unwrap(uses) as { coupon_id: string }[]) count.set(r.coupon_id, (count.get(r.coupon_id) ?? 0) + 1);
      return (unwrap(coupons) as Coupon[]).map((c) => ({ ...c, used: count.get(c.id) ?? 0 })) as CouponWithUse[];
    },

    async saveCoupon(row) {
      await upsert("coupons", { ...row, code: row.code.trim().toUpperCase() });
    },

    async deleteCoupon(id) {
      check(await db.from("coupons").delete().eq("id", id));
    },

    // ---------------------------------------------------------------- photos
    async uploadImage(file, folder) {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      check(await db.storage.from("catalog").upload(path, file, { contentType: file.type || "image/jpeg", cacheControl: "31536000", upsert: false }));
      return db.storage.from("catalog").getPublicUrl(path).data.publicUrl;
    },

    // ---------------------------------------------------------------- stall logins (server route with the service key)
    async listStallLogins() {
      return (await adminApi("GET")) as StallLogin[];
    },

    async setStallLogin(stallId, login, password) {
      await adminApi("POST", { stall_id: stallId, email: login, password });
    },

    async resetDemo() {
      throw new Error("Nothing to reset: this is the live database.");
    },
  };
}
