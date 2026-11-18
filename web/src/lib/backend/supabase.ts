// Supabase backend: the shared database used by the website and the Flutter apps.
// Schema, security rules and the rpc functions called here live in supabase/migrations.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Catalog, Coupon, CouponWithUse, Order, Park, Profile, Session, StallLogin, StallTicket, SupportRequest } from "../types";
import { slugify, type Backend, type Unsubscribe } from "./types";

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
  const adminApi = async (method: "GET" | "POST", body?: unknown) => {
    const { data } = await db.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("sign_in_required");
    const res = await fetch("/api/admin/stall-logins", {
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
      const [park, cravings, banners, stalls, categories, items] = await Promise.all([
        db.from("park_settings").select("*").eq("id", 1).single(),
        db.from("cravings").select("*").order("sort_order"),
        db.from("banners").select("*").order("sort_order"),
        db.from("stalls").select("*").order("sort_order"),
        db.from("menu_categories").select("*").order("sort_order"),
        db.from("menu_items").select("*").order("sort_order"),
      ]);
      const parkRow = unwrap(park) as Park;
      return {
        park: { ...parkRow, tax_percent: Number(parkRow.tax_percent) },
        cravings: unwrap(cravings),
        banners: unwrap(banners),
        stalls: unwrap(stalls),
        menu_categories: unwrap(categories),
        menu_items: unwrap(items),
      } as Catalog;
    },

    onCatalogChange: (cb) => watch(["menu_items", "stalls"], cb),

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

    async setStallOrderStatus(stallOrderId, status) {
      check(await db.rpc("set_stall_order_status", { p_stall_order_id: stallOrderId, p_status: status }));
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
