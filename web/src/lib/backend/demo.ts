// Demo backend: the seed catalog plus localStorage. No network, no accounts.
// It follows the same rules as the database functions in supabase/migrations/0001_init.sql
// so the UI behaves the same once the real backend is connected.

import seed from "@/data/catalog.json";
import { computeBill } from "../format";
import type {
  Catalog,
  Coupon,
  Order,
  OrderItem,
  Profile,
  Session,
  StallOrder,
  StallTicket,
  SupportRequest,
  TicketStatus,
} from "../types";
import { slugify, type Area, type Backend, type Unsubscribe } from "./types";

type Topic = "catalog" | "orders" | "session" | "support" | "coupons";

const K = {
  catalog: "osfp.demo.catalog",
  orders: "osfp.demo.orders",
  support: "osfp.demo.support",
  coupons: "osfp.demo.coupons",
  stallLogins: "osfp.demo.stall-logins",
  session: (area: Area) => `osfp.demo.session.${area}`,
};

const seedCatalog = seed as unknown as Catalog;
const seedStamp = String(JSON.stringify(seed).length);

const sleep = (ms = 140) => new Promise((r) => setTimeout(r, ms));
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const now = () => new Date().toISOString();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

class DemoError extends Error {}
const fail = (code: string): never => {
  throw new DemoError(code);
};

export function createDemoBackend(): Backend {
  const listeners: Record<Topic, Set<() => void>> = { catalog: new Set(), orders: new Set(), session: new Set(), support: new Set(), coupons: new Set() };
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("osfp-demo") : null;

  const emitLocal = (topic: Topic) => listeners[topic].forEach((cb) => cb());
  const emit = (topic: Topic) => {
    emitLocal(topic);
    channel?.postMessage(topic);
  };
  if (channel) channel.onmessage = (e) => emitLocal(e.data as Topic);

  const subscribe = (topic: Topic, cb: () => void): Unsubscribe => {
    listeners[topic].add(cb);
    return () => listeners[topic].delete(cb);
  };

  // ---- catalog (seed unless the admin or a stall edited it)
  const loadCatalog = (): Catalog => {
    const stored = read<{ stamp: string; catalog: Catalog } | null>(K.catalog, null);
    if (stored && stored.stamp === seedStamp) return stored.catalog;
    return structuredClone(seedCatalog);
  };
  const saveCatalog = (catalog: Catalog) => {
    write(K.catalog, { stamp: seedStamp, catalog });
    emit("catalog");
  };
  const editCatalog = (fn: (c: Catalog) => void) => {
    const c = loadCatalog();
    fn(c);
    saveCatalog(c);
  };

  // ---- orders
  const loadOrders = () => read<Order[]>(K.orders, []);
  const saveOrders = (orders: Order[]) => {
    write(K.orders, orders);
    emit("orders");
  };

  const syncOrderStatus = (order: Order) => {
    const open = order.stall_orders.some((s) => s.status !== "completed" && s.status !== "cancelled");
    if (open) return;
    order.status = order.stall_orders.some((s) => s.status === "completed") ? "completed" : "cancelled";
  };

  // ---- sessions
  const loadSession = (area: Area) => read<Session | null>(K.session(area), null);
  const saveSession = (area: Area, session: Session | null) => {
    if (session) write(K.session(area), session);
    else localStorage.removeItem(K.session(area));
    emit("session");
  };
  const requireStaff = (stallId: string) => {
    const s = loadSession("staff");
    if (!s || !(s.profile.role === "admin" || s.staff_stall_ids.includes(stallId))) fail("forbidden");
  };
  const requireAdmin = () => {
    if (loadSession("staff")?.profile.role !== "admin") fail("forbidden");
  };

  // ---- coupons: same rules as _coupon_quote() in supabase/migrations/0005_coupons.sql
  const loadCoupons = () => read<Coupon[]>(K.coupons, []);
  const saveCoupons = (rows: Coupon[]) => {
    write(K.coupons, rows);
    emit("coupons");
  };
  const usedCount = (couponId: string, customerId?: string) =>
    loadOrders().filter((o) => o.coupon_code && o.status !== "cancelled" && (o as Order & { coupon_id?: string }).coupon_id === couponId && (!customerId || o.customer_id === customerId)).length;

  const quote = (code: string, customerId: string | null, items: { menu_item_id: string; qty: number }[]) => {
    const catalog = loadCatalog();
    if (!catalog.park.coupons_enabled) fail("coupons_disabled");
    const c = loadCoupons().find((x) => x.code === code.trim().toUpperCase()) ?? fail("coupon_not_found");
    if (!c.is_active) fail("coupon_inactive");
    if (c.starts_at && Date.now() < new Date(c.starts_at).getTime()) fail("coupon_not_started");
    if (c.ends_at && Date.now() >= new Date(c.ends_at).getTime()) fail("coupon_expired");
    const eligible = items.reduce((n, l) => {
      const m = catalog.menu_items.find((x) => x.id === l.menu_item_id);
      return m && l.qty >= 1 && l.qty <= 50 && (!c.stall_id || m.stall_id === c.stall_id) ? n + m.price_cents * l.qty : n;
    }, 0);
    if (eligible === 0) fail("coupon_not_applicable");
    if (eligible < c.min_order_cents) fail("coupon_min_order");
    if (c.usage_limit != null && usedCount(c.id) >= c.usage_limit) fail("coupon_used_up");
    if (c.per_customer_limit != null && customerId && usedCount(c.id, customerId) >= c.per_customer_limit) fail("coupon_already_used");
    let discount = c.kind === "percent" ? Math.round((eligible * c.value) / 100) : c.value;
    if (c.max_discount_cents != null) discount = Math.min(discount, c.max_discount_cents);
    discount = Math.min(discount, eligible);
    return { coupon: c, eligible, discount };
  };

  // ---- stall logins (demo): login email + password per stall, kept in this browser only.
  // A real deployment uses Supabase Auth accounts instead (see /api/admin/stall-logins).
  const loadLogins = () => read<Record<string, { login: string; hash: string }>>(K.stallLogins, {});
  const hashPassword = (login: string, password: string) => {
    // Demo only: a fast string hash so the password is not stored as typed. Not real security.
    let h1 = 0xdeadbeef ^ password.length;
    let h2 = 0x41c6ce57 ^ login.length;
    for (const ch of `${login.toLowerCase()}:${password}`) {
      const k = ch.charCodeAt(0);
      h1 = Math.imul(h1 ^ k, 2654435761);
      h2 = Math.imul(h2 ^ k, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };

  const makeSession = (profile: Profile, stallIds: string[] = []): Session => ({
    user_id: profile.id,
    profile,
    staff_stall_ids: stallIds,
    email: null,
  });

  return {
    mode: "demo",

    async getCatalog() {
      await sleep();
      return loadCatalog();
    },
    onCatalogChange: (cb) => subscribe("catalog", cb),

    async getSession(area) {
      return loadSession(area);
    },
    onSessionChange: (cb) => subscribe("session", cb),

    async requestOtp() {
      await sleep(300);
    },

    async verifyOtp(phone, code) {
      await sleep(300);
      if (!/^\d{6}$/.test(code)) throw new DemoError("Enter the 6-digit code.");
      const id = `demo-customer-${phone.replace(/\D/g, "")}`;
      const previous = loadSession("customer");
      const session = makeSession({
        id,
        phone,
        full_name: previous?.user_id === id ? previous.profile.full_name : null,
        role: "customer",
      });
      saveSession("customer", session);
      return session;
    },

    async signInWithGoogle(area) {
      await sleep(400);
      // Stands in for a Google account; nothing leaves the browser.
      const session: Session = {
        ...makeSession({ id: "demo-google-guest", phone: null, full_name: "Demo Guest", role: "customer" }),
        email: "demo.guest@gmail.com",
      };
      saveSession(area, session);
    },

    async signInWithPassword(login, password) {
      await sleep(300);
      const wanted = login.trim().toLowerCase();
      const entry = Object.entries(loadLogins()).find(([, v]) => v.login.toLowerCase() === wanted);
      if (!entry || entry[1].hash !== hashPassword(entry[1].login, password)) fail("bad_login");
      const [stallId, { login: email }] = entry!;
      const stall = loadCatalog().stalls.find((s) => s.id === stallId);
      const session: Session = {
        ...makeSession({ id: `demo-staff-${stallId}`, full_name: stall?.name ?? "Stall", phone: null, role: "stall_staff" }, [stallId]),
        email,
      };
      saveSession("staff", session);
      return session;
    },

    async demoStaffSignIn() {
      await sleep(200);
      const catalog = loadCatalog();
      const session = makeSession({ id: "demo-admin", full_name: "Park admin", phone: null, role: "admin" }, catalog.stalls.map((s) => s.id));
      saveSession("staff", session);
      return session;
    },

    async updateProfile(area, patch) {
      const s = loadSession(area);
      if (!s) return;
      saveSession(area, { ...s, profile: { ...s.profile, full_name: patch.full_name } });
    },

    async signOut(area) {
      saveSession(area, null);
    },

    // ---------------------------------------------------------------- customer orders
    async placeOrder(input) {
      await sleep(450);
      const session = loadSession("customer") ?? fail("sign_in_required");
      const catalog = loadCatalog();
      if (!catalog.park.ordering_enabled) fail("ordering_closed");
      const name = input.customer_name.trim();
      if (!name) fail("name_required");
      let table = input.table_no?.trim() || null;
      if (input.fulfilment === "table") {
        if (!catalog.park.table_service_enabled) fail("table_service_unavailable");
        if (!table) fail("table_required");
      } else table = null;
      if (!input.items.length) fail("cart_empty");

      const lines = input.items.map((l) => {
        const item = catalog.menu_items.find((m) => m.id === l.menu_item_id) ?? fail("item_not_found");
        const stall = catalog.stalls.find((s) => s.id === item.stall_id) ?? fail("item_not_found");
        if (!(Number.isInteger(l.qty) && l.qty >= 1 && l.qty <= 50)) fail("bad_quantity");
        if (!item.is_available) fail("item_unavailable");
        if (!stall.is_open || !stall.is_active) fail("stall_closed");
        return { item, stall, qty: l.qty, note: l.note?.trim() || null };
      });

      const itemTotal = lines.reduce((sum, l) => sum + l.item.price_cents * l.qty, 0);
      const applied = input.coupon_code?.trim() ? quote(input.coupon_code, session.user_id, input.items) : null;
      const bill = computeBill(itemTotal, catalog.park, Math.max(0, input.tip_cents || 0), applied?.discount ?? 0);
      const online = input.payment_method === "online";
      const orders = loadOrders();
      const orderId = uid();
      const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      const orderNo = `OS-${Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
      const today = new Date().toDateString();
      const created = now();

      const stallIds = [...new Set(lines.map((l) => l.stall.id))].sort();
      let taxLeft = bill.tax_cents;
      let discountLeft = bill.discount_cents;
      const scope = applied?.coupon.stall_id ?? null;
      const stallOrders: StallOrder[] = stallIds.map((stallId, stallNo) => {
        const mine = lines.filter((l) => l.stall.id === stallId);
        const subtotal = mine.reduce((sum, l) => sum + l.item.price_cents * l.qty, 0);
        // Same splits as place_order: by share of eligible dishes; the last stall takes the remainder.
        const last = stallNo === stallIds.length - 1;
        const discount =
          !applied || (scope && scope !== stallId)
            ? 0
            : last || scope
              ? discountLeft
              : Math.min(Math.round((bill.discount_cents * subtotal) / Math.max(applied.eligible, 1)), discountLeft);
        discountLeft -= discount;
        const tax = last ? taxLeft : Math.min(Math.round(((subtotal - discount) * Number(catalog.park.tax_percent)) / 100), taxLeft);
        taxLeft -= tax;
        const stall = mine[0].stall;
        const lastToken = Math.max(
          0,
          ...orders
            .flatMap((o) => o.stall_orders)
            .filter((s) => s.stall_id === stallId && new Date(s.created_at).toDateString() === today)
            .map((s) => s.token_no),
        );
        const id = uid();
        const items: OrderItem[] = mine.map((l) => ({
          id: uid(),
          stall_order_id: id,
          menu_item_id: l.item.id,
          name: l.item.name,
          diet: l.item.diet,
          unit_price_cents: l.item.price_cents,
          qty: l.qty,
          note: l.note,
        }));
        return {
          id,
          order_id: orderId,
          stall_id: stallId,
          token_no: lastToken + 1,
          status: online ? "pending" : "placed",
          subtotal_cents: subtotal,
          discount_cents: discount,
          tax_cents: tax,
          created_at: created,
          placed_at: online ? null : created,
          accepted_at: null,
          ready_at: null,
          completed_at: null,
          order_items: items,
          stall: {
            id: stall.id,
            slug: stall.slug,
            name: stall.name,
            location_label: stall.location_label,
            logo_url: stall.logo_url,
            phone: stall.phone,
          },
        };
      });

      const order: Order = {
        id: orderId,
        order_no: orderNo,
        customer_id: session.user_id,
        customer_name: name,
        customer_phone: input.customer_phone,
        fulfilment: input.fulfilment,
        table_no: table,
        note: input.note?.trim() || null,
        ...bill,
        coupon_code: applied?.coupon.code ?? null,
        ...(applied ? { coupon_id: applied.coupon.id } : {}),
        payment_method: input.payment_method,
        payment_status: "unpaid",
        status: online ? "awaiting_payment" : "active",
        created_at: created,
        stall_orders: stallOrders,
      };
      saveOrders([order, ...orders]);
      if (!session.profile.full_name) saveSession("customer", { ...session, profile: { ...session.profile, full_name: name } });
      return { order_id: orderId, order_no: orderNo, total_cents: bill.total_cents, discount_cents: bill.discount_cents };
    },

    async listMyOrders() {
      await sleep();
      const session = loadSession("customer");
      if (!session) return [];
      return loadOrders().filter((o) => o.customer_id === session.user_id);
    },

    async getOrder(id) {
      await sleep(80);
      const session = loadSession("customer");
      return loadOrders().find((o) => o.id === id && o.customer_id === session?.user_id) ?? null;
    },

    onOrdersChange: (cb) => subscribe("orders", cb),

    async cancelOrder(id) {
      await sleep(250);
      const orders = loadOrders();
      const order = orders.find((o) => o.id === id) ?? fail("not_found");
      if (order.stall_orders.some((s) => !["pending", "placed", "cancelled"].includes(s.status))) fail("already_in_progress");
      order.stall_orders.forEach((s) => {
        if (s.status !== "cancelled") {
          s.status = "cancelled";
          s.completed_at = now();
        }
      });
      order.status = "cancelled";
      saveOrders(orders);
    },

    async startPayment() {
      return { kind: "demo" };
    },

    async checkPayment() {
      return "waiting";
    },

    async confirmDemoPayment(orderId) {
      await sleep(900);
      const orders = loadOrders();
      const order = orders.find((o) => o.id === orderId) ?? fail("not_found");
      order.payment_status = "paid";
      if (order.status === "awaiting_payment") order.status = "active";
      order.stall_orders.forEach((s) => {
        if (s.status === "pending") {
          s.status = "placed";
          s.placed_at = now();
        }
      });
      saveOrders(orders);
    },

    // ---------------------------------------------------------------- stall staff
    async listStallTickets(stallId) {
      await sleep();
      requireStaff(stallId);
      const tickets: StallTicket[] = [];
      for (const o of loadOrders()) {
        for (const s of o.stall_orders) {
          if (s.stall_id !== stallId || s.status === "pending") continue;
          tickets.push({
            ...s,
            order: {
              id: o.id,
              order_no: o.order_no,
              customer_name: o.customer_name,
              customer_phone: o.customer_phone,
              fulfilment: o.fulfilment,
              table_no: o.table_no,
              note: o.note,
              payment_method: o.payment_method,
              payment_status: o.payment_status,
            },
          });
        }
      }
      return tickets;
    },

    async setStallOrderStatus(stallOrderId, status) {
      await sleep(200);
      const orders = loadOrders();
      const order = orders.find((o) => o.stall_orders.some((s) => s.id === stallOrderId)) ?? fail("not_found");
      const so = order.stall_orders.find((s) => s.id === stallOrderId)!;
      requireStaff(so.stall_id);
      const allowed: Partial<Record<TicketStatus, TicketStatus[]>> = {
        placed: ["preparing", "cancelled"],
        preparing: ["ready", "cancelled"],
        ready: ["completed"],
      };
      if (!allowed[so.status]?.includes(status)) fail("invalid_transition");
      so.status = status;
      if (status === "preparing") so.accepted_at = now();
      if (status === "ready") so.ready_at = now();
      if (status === "completed" || status === "cancelled") so.completed_at = now();
      syncOrderStatus(order);
      saveOrders(orders);
    },

    async setItemAvailable(itemId, available) {
      await sleep(120);
      const item = loadCatalog().menu_items.find((m) => m.id === itemId) ?? fail("not_found");
      requireStaff(item.stall_id);
      editCatalog((c) => {
        c.menu_items.find((m) => m.id === itemId)!.is_available = available;
      });
    },

    async setStallOpen(stallId, open) {
      await sleep(120);
      requireStaff(stallId);
      editCatalog((c) => {
        const stall = c.stalls.find((s) => s.id === stallId) ?? fail("not_found");
        stall.is_open = open;
      });
    },

    // ---------------------------------------------------------------- admin
    async listAllOrders() {
      await sleep();
      requireAdmin();
      return loadOrders();
    },

    async saveStall(row) {
      requireAdmin();
      editCatalog((c) => {
        const existing = row.id ? c.stalls.find((s) => s.id === row.id) : undefined;
        if (existing) Object.assign(existing, row);
        else {
          const slug = row.slug || slugify(row.name);
          c.stalls.push({
            id: slug,
            slug,
            tagline: null,
            cuisines: [],
            location_label: null,
            phone: null,
            instagram: null,
            logo_url: null,
            cover_url: null,
            is_veg_only: false,
            avg_prep_mins: null,
            is_open: true,
            is_active: true,
            sort_order: c.stalls.length + 1,
            ...row,
          });
        }
      });
    },

    async deleteStall(id) {
      requireAdmin();
      editCatalog((c) => {
        c.stalls = c.stalls.filter((s) => s.id !== id);
        c.menu_categories = c.menu_categories.filter((m) => m.stall_id !== id);
        c.menu_items = c.menu_items.filter((m) => m.stall_id !== id);
        c.banners = c.banners.filter((b) => b.stall_id !== id);
      });
    },

    async saveCategory(row) {
      requireAdmin();
      editCatalog((c) => {
        const existing = row.id ? c.menu_categories.find((m) => m.id === row.id) : undefined;
        if (existing) Object.assign(existing, row);
        else
          c.menu_categories.push({
            id: uid(),
            sort_order: c.menu_categories.filter((m) => m.stall_id === row.stall_id).length + 1,
            ...row,
          });
      });
    },

    async deleteCategory(id) {
      requireAdmin();
      editCatalog((c) => {
        c.menu_categories = c.menu_categories.filter((m) => m.id !== id);
        c.menu_items = c.menu_items.filter((m) => m.category_id !== id);
      });
    },

    async saveItem(row) {
      requireAdmin();
      editCatalog((c) => {
        const existing = row.id ? c.menu_items.find((m) => m.id === row.id) : undefined;
        if (existing) Object.assign(existing, row);
        else
          c.menu_items.push({
            id: uid(),
            description: null,
            diet: null,
            image_url: null,
            craving: null,
            is_available: true,
            is_featured: false,
            serves: null,
            size_label: null,
            sort_order: c.menu_items.filter((m) => m.category_id === row.category_id).length + 1,
            ...row,
          });
        if (row.id && c.placeholder_price_item_ids)
          c.placeholder_price_item_ids = c.placeholder_price_item_ids.filter((x) => x !== row.id);
      });
    },

    async deleteItem(id) {
      requireAdmin();
      editCatalog((c) => {
        c.menu_items = c.menu_items.filter((m) => m.id !== id);
      });
    },

    async saveBanner(row) {
      requireAdmin();
      editCatalog((c) => {
        const existing = row.id ? c.banners.find((b) => b.id === row.id) : undefined;
        if (existing) Object.assign(existing, row);
        else
          c.banners.push({
            id: uid(),
            subtitle: null,
            image_url: null,
            stall_id: null,
            menu_item_id: null,
            is_active: true,
            sort_order: c.banners.length + 1,
            ...row,
          });
      });
    },

    async deleteBanner(id) {
      requireAdmin();
      editCatalog((c) => {
        c.banners = c.banners.filter((b) => b.id !== id);
      });
    },

    async saveSettings(patch) {
      requireAdmin();
      editCatalog((c) => {
        Object.assign(c.park, patch);
      });
    },

    // ---------------------------------------------------------------- help & support
    async submitSupportRequest(input) {
      await sleep(400);
      const name = input.name.trim();
      const contact = input.contact.trim();
      const message = input.message.trim();
      if (!name) fail("name_required");
      if (contact.length < 3) fail("contact_required");
      if (message.length < 5) fail("message_too_short");
      if (message.length > 2000) fail("message_too_long");
      const all = read<SupportRequest[]>(K.support, []);
      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (all.filter((r) => r.contact.toLowerCase() === contact.toLowerCase() && new Date(r.created_at).getTime() > hourAgo).length >= 5)
        fail("too_many_messages");
      const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      const row: SupportRequest = {
        id: uid(),
        ref_no: `HS-${Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`,
        customer_id: loadSession("customer")?.user_id ?? null,
        name: name.slice(0, 80),
        contact: contact.slice(0, 120),
        topic: input.topic,
        order_no: input.order_no?.trim().toUpperCase().slice(0, 20) || null,
        message,
        status: "new",
        created_at: now(),
        handled_at: null,
      };
      write(K.support, [row, ...all]);
      emit("support");
      return { id: row.id, ref_no: row.ref_no };
    },

    async listSupportRequests() {
      await sleep();
      requireAdmin();
      return read<SupportRequest[]>(K.support, []);
    },

    async setSupportRequestStatus(id, status) {
      requireAdmin();
      const all = read<SupportRequest[]>(K.support, []);
      const row = all.find((r) => r.id === id) ?? fail("not_found");
      row.status = status;
      row.handled_at = status === "new" ? null : now();
      write(K.support, all);
      emit("support");
    },

    onSupportChange: (cb) => subscribe("support", cb),

    // ---------------------------------------------------------------- coupons
    async listOffers() {
      const nowMs = Date.now();
      return loadCoupons().filter((c) => c.is_active && c.show_in_app && (!c.ends_at || new Date(c.ends_at).getTime() > nowMs));
    },

    async quoteCoupon(code, items) {
      await sleep(250);
      const { coupon, discount } = quote(code, loadSession("customer")?.user_id ?? null, items);
      return { code: coupon.code, title: coupon.title, stall_id: coupon.stall_id, discount_cents: discount };
    },

    async listCoupons() {
      requireAdmin();
      return loadCoupons()
        .map((c) => ({ ...c, used: usedCount(c.id) }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async saveCoupon(row) {
      requireAdmin();
      const code = row.code.trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9_-]{2,23}$/.test(code)) fail("Codes are 3–24 letters, digits, - or _.");
      const all = loadCoupons();
      if (all.some((c) => c.code === code && c.id !== row.id)) fail("That code already exists.");
      const existing = row.id ? all.find((c) => c.id === row.id) : undefined;
      if (existing) Object.assign(existing, row, { code });
      else
        all.push({
          id: uid(),
          description: null,
          min_order_cents: 0,
          max_discount_cents: null,
          stall_id: null,
          starts_at: null,
          ends_at: null,
          usage_limit: null,
          per_customer_limit: null,
          is_active: true,
          show_in_app: true,
          created_at: now(),
          ...row,
          code,
        });
      saveCoupons(all);
    },

    async deleteCoupon(id) {
      requireAdmin();
      saveCoupons(loadCoupons().filter((c) => c.id !== id));
    },

    // ---------------------------------------------------------------- photos
    async uploadImage(file) {
      requireAdmin();
      // Demo: keep the (already resized) photo in this browser as a data URL.
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new DemoError("Could not read that photo."));
        reader.readAsDataURL(file);
      });
    },

    // ---------------------------------------------------------------- stall logins
    async listStallLogins() {
      requireAdmin();
      const logins = loadLogins();
      return loadCatalog().stalls.map((s) => ({ stall_id: s.id, login: logins[s.id]?.login ?? null }));
    },

    async setStallLogin(stallId, login, password) {
      requireAdmin();
      const email = login.trim().toLowerCase();
      const logins = loadLogins();
      if (Object.entries(logins).some(([id, v]) => id !== stallId && v.login.toLowerCase() === email)) fail("login_taken");
      logins[stallId] = { login: email, hash: hashPassword(email, password) };
      write(K.stallLogins, logins);
      // Anyone signed in as this stall with the old login is signed out.
      const current = loadSession("staff");
      if (current?.profile.role === "stall_staff" && current.staff_stall_ids.includes(stallId) && current.email !== email) saveSession("staff", null);
    },

    async resetDemo() {
      localStorage.removeItem(K.catalog);
      localStorage.removeItem(K.orders);
      localStorage.removeItem(K.support);
      localStorage.removeItem(K.coupons);
      localStorage.removeItem(K.stallLogins);
      emit("catalog");
      emit("orders");
      emit("support");
      emit("coupons");
    },
  };
}
