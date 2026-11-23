// Runs the migration and seed against an in-memory Postgres (PGlite) and checks the
// order functions and row-level security. No Supabase project needed.
//   npm run db:test
//
// The shim below stands in for the parts Supabase provides (auth schema, roles,
// storage tables, realtime publication).

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  phone text, email text, raw_user_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
`;

const db = new PGlite();
let passed = 0;
const failures = [];

const check = (name, ok, detail = "") => {
  if (ok) passed += 1;
  else failures.push(`${name}${detail ? ` -> ${detail}` : ""}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
};

const as = async (role, uid) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  if (role !== "postgres") await db.exec(`set role ${role}`);
};
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await rows(sql, params))[0];
const fails = async (sql, params = []) => {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e.message;
  }
};

await db.exec(SHIM);
// setup.sql = every migration + the seed (npm run db:bundle); this is exactly what a new project runs.
await db.exec(read("supabase/setup.sql"));
// re-running the seed must be harmless
await db.exec(read("supabase/seed.sql"));

const catalog = JSON.parse(read("shared/seed/catalog.json"));

// ---- users
const mk = async (phone) => (await one("insert into auth.users (phone) values ($1) returning id", [phone])).id;
const customer = await mk("+14085550101");
const staff = await mk("+14085550102");
const admin = await mk("+14085550103");
const stranger = await mk("+14085550104");
await db.query("update public.profiles set role = 'stall_staff' where id = $1", [staff]);
await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
await db.query("insert into public.stall_staff (stall_id, user_id) values ('pandemkodi-dhaba', $1)", [staff]);

check("profile created for each new user", (await one("select count(*)::int n from public.profiles")).n === 4);

// ---- catalog is public
await as("anon");
check("anon reads stalls", (await one("select count(*)::int n from public.stalls")).n === catalog.stalls.length);
check("anon reads menu items", (await one("select count(*)::int n from public.menu_items")).n === catalog.menu_items.length);
check(
  "every seeded dish has a description",
  (await one("select count(*)::int n from public.menu_items where description is null")).n === 0,
);
check(
  "Desi Desserts sizes: 8 oz for apricot delight, rasmalai, gulab jamun; 12 oz for the drinks; none for brownie and poornalu",
  (await one("select count(*)::int n from public.menu_items where stall_id = 'desi-desserts' and size_label = '8 oz'")).n === 3 &&
    (await one("select count(*)::int n from public.menu_items where stall_id = 'desi-desserts' and size_label = '12 oz' and serves is null")).n === 10 &&
    (await one("select count(*)::int n from public.menu_items where stall_id = 'desi-desserts' and size_label is null and serves is null")).n === 2,
);
check("anon cannot place an order", /permission denied|sign_in_required/.test((await fails("select public.place_order('{}'::jsonb)")) ?? ""));

// ---- customer places a two-stall order, pay at stall
const PULKA = "pandemkodi-dhaba.fresh-live-pulka";
const FALOODA = "desi-desserts.royal-falooda";
const LASSI = "desi-desserts.mango-lassi";
const payload = (over = {}) =>
  JSON.stringify({
    fulfilment: "pickup",
    customer_name: "Test Customer",
    customer_phone: "+14085550101",
    payment_method: "pay_at_stall",
    items: [
      { menu_item_id: PULKA, qty: 4 },
      { menu_item_id: FALOODA, qty: 1, note: "less ice" },
      { menu_item_id: LASSI, qty: 2 },
    ],
    ...over,
  });

await as("authenticated", customer);
const placed = (await one("select public.place_order($1::jsonb) as r", [payload()])).r;
const expectedTotal = 4 * 199 + 899 + 2 * 799;
check("place_order returns an order number", /^OS-[2-9A-HJ-NP-Z]{5}$/.test(placed.order_no), placed.order_no);
check("server computes the total from its own prices", placed.total_cents === expectedTotal, String(placed.total_cents));

const myOrder = await one("select * from public.orders where id = $1", [placed.order_id]);
check("pay-at-stall order is active immediately", myOrder?.status === "active" && myOrder?.payment_status === "unpaid");
const myStallOrders = await rows("select * from public.stall_orders where order_id = $1 order by stall_id", [placed.order_id]);
check("order split into one stall order per stall", myStallOrders.length === 2);
check("first token of the day is 1 at each stall", myStallOrders.every((s) => s.token_no === 1 && s.status === "placed"));
check(
  "stall subtotals add up",
  myStallOrders.reduce((a, s) => a + s.subtotal_cents, 0) === expectedTotal,
);
check("customer sees own line items", (await one("select count(*)::int n from public.order_items")).n === 3);

// ---- customer cannot bypass the functions
check("customer cannot insert orders directly", /permission denied/.test((await fails("insert into public.orders (order_no, customer_id, customer_name, fulfilment, item_total_cents, total_cents, payment_method, status) values ('X', $1, 'x', 'pickup', 0, 0, 'online', 'active')", [customer])) ?? ""));
check("customer cannot edit a stall order", /permission denied/.test((await fails("update public.stall_orders set status = 'ready'")) ?? ""));
check("customer cannot make themselves admin", /forbidden|permission denied/.test((await fails("update public.profiles set role = 'admin' where id = $1", [customer])) ?? ""));
check("customer cannot mark an order paid", /permission denied/.test((await fails("select public.mark_order_paid($1, 'x')", [placed.order_id])) ?? ""));
check("customer cannot move a stall order", /forbidden/.test((await fails("select public.set_stall_order_status($1, 'preparing')", [myStallOrders[0].id])) ?? ""));
await db.query("update public.menu_items set price_cents = 1 where id = $1", [PULKA]);
await as("postgres");
check("customer cannot change prices", (await one("select price_cents from public.menu_items where id = $1", [PULKA])).price_cents === 199);

// ---- validation
await as("authenticated", customer);
check("empty cart rejected", /cart_empty/.test((await fails("select public.place_order($1::jsonb)", [payload({ items: [] })])) ?? ""));
check("unknown item rejected", /item_not_found/.test((await fails("select public.place_order($1::jsonb)", [payload({ items: [{ menu_item_id: "nope", qty: 1 }] })])) ?? ""));
check("zero quantity rejected", /bad_quantity/.test((await fails("select public.place_order($1::jsonb)", [payload({ items: [{ menu_item_id: PULKA, qty: 0 }] })])) ?? ""));
check("table order needs a table number", /table_required/.test((await fails("select public.place_order($1::jsonb)", [payload({ fulfilment: "table" })])) ?? ""));
check("missing name rejected", /name_required/.test((await fails("select public.place_order($1::jsonb)", [payload({ customer_name: "  " })])) ?? ""));

// ---- online order stays hidden from the stall until paid
const online = (await one("select public.place_order($1::jsonb) as r", [payload({ payment_method: "online", fulfilment: "table", table_no: "12" })])).r;
const onlineOrder = await one("select * from public.orders where id = $1", [online.order_id]);
check("online order waits for payment", onlineOrder.status === "awaiting_payment" && onlineOrder.table_no === "12");
const onlineStallOrders = await rows("select * from public.stall_orders where order_id = $1 order by stall_id", [online.order_id]);
check("second order of the day gets token 2", onlineStallOrders.every((s) => s.token_no === 2 && s.status === "pending"));

// ---- stranger sees nothing
await as("authenticated", stranger);
check("another customer sees no orders", (await one("select count(*)::int n from public.orders")).n === 0);
check("another customer sees no stall orders", (await one("select count(*)::int n from public.stall_orders")).n === 0);
check("another customer cannot cancel it", /not_found/.test((await fails("select public.cancel_order($1)", [placed.order_id])) ?? ""));

// ---- stall staff
await as("authenticated", staff);
let staffView = await rows("select * from public.stall_orders");
check("staff sees only own stall's paid/placed orders", staffView.length === 1 && staffView[0].stall_id === "pandemkodi-dhaba");
check("staff sees the parent order", (await one("select count(*)::int n from public.orders")).n === 1);
check("staff sees only own stall's line items", (await one("select count(*)::int n from public.order_items")).n === 1);
const pkTicket = myStallOrders.find((s) => s.stall_id === "pandemkodi-dhaba");
const ddTicket = myStallOrders.find((s) => s.stall_id === "desi-desserts");
check("staff cannot touch another stall's order", /forbidden/.test((await fails("select public.set_stall_order_status($1, 'preparing')", [ddTicket.id])) ?? ""));
check("cannot skip straight to ready", /invalid_transition/.test((await fails("select public.set_stall_order_status($1, 'ready')", [pkTicket.id])) ?? ""));
await db.query("select public.set_stall_order_status($1, 'preparing')", [pkTicket.id]);
await db.query("select public.set_stall_order_status($1, 'ready')", [pkTicket.id]);
await db.query("select public.set_stall_order_status($1, 'completed')", [pkTicket.id]);
check("staff moves order placed -> preparing -> ready -> completed", (await one("select status, ready_at, completed_at from public.stall_orders where id = $1", [pkTicket.id])).status === "completed");
await db.query("select public.set_item_available($1, false)", [PULKA]);
check("staff cannot mark another stall's item", /forbidden/.test((await fails("select public.set_item_available($1, false)", [FALOODA])) ?? ""));

// ---- payment server marks the online order paid
await as("service_role");
await db.query("select public.mark_order_paid($1, 'pi_test_123')", [online.order_id]);
await as("authenticated", staff);
staffView = await rows("select * from public.stall_orders where status = 'placed'");
check("paid online order appears for the stall", staffView.length === 1 && staffView[0].order_id === online.order_id);

// ---- customer side effects
await as("authenticated", customer);
check("parent order still active while one stall is open", (await one("select status from public.orders where id = $1", [placed.order_id])).status === "active");
check("out-of-stock item rejected", /item_unavailable/.test((await fails("select public.place_order($1::jsonb)", [payload()])) ?? ""));
check("cannot cancel once a stall has started", /already_in_progress/.test((await fails("select public.cancel_order($1)", [placed.order_id])) ?? ""));
await db.query("select public.cancel_order($1)", [online.order_id]);
check("customer cancels an untouched order", (await one("select status from public.orders where id = $1", [online.order_id])).status === "cancelled");

// ---- admin
await as("authenticated", admin);
await db.query("select public.set_stall_order_status($1, 'preparing')", [ddTicket.id]);
await db.query("select public.set_stall_order_status($1, 'ready')", [ddTicket.id]);
await db.query("select public.set_stall_order_status($1, 'completed')", [ddTicket.id]);
check("order completes when every stall order is done", (await one("select status from public.orders where id = $1", [placed.order_id])).status === "completed");
await db.query("update public.menu_items set price_cents = 249, is_available = true where id = $1", [PULKA]);
check("admin edits prices", (await one("select price_cents from public.menu_items where id = $1", [PULKA])).price_cents === 249);
await db.query("update public.park_settings set tax_percent = 9.375 where id = 1");
await db.query("select public.set_stall_open('desi-desserts', false)");

// ---- tax and closed stall
await as("authenticated", customer);
check("closed stall rejected", /stall_closed/.test((await fails("select public.place_order($1::jsonb)", [payload()])) ?? ""));
const taxed = (await one("select public.place_order($1::jsonb) as r", [payload({ items: [{ menu_item_id: PULKA, qty: 3 }], tip_cents: 100 })])).r;
const taxedOrder = await one("select * from public.orders where id = $1", [taxed.order_id]);
check(
  "tax rounds to the cent and tip is added",
  taxedOrder.item_total_cents === 747 && taxedOrder.tax_cents === 70 && taxedOrder.total_cents === 747 + 70 + 100,
  JSON.stringify({ t: taxedOrder.tax_cents, total: taxedOrder.total_cents }),
);

const taxedStall = await rows("select tax_cents from public.stall_orders where order_id = $1", [taxed.order_id]);
check("single-stall order: the stall carries the whole tax", taxedStall.length === 1 && taxedStall[0].tax_cents === 70);

// ---- tax is split across stalls and the shares add up to the order's tax
await as("authenticated", admin);
await db.query("select public.set_stall_open('desi-desserts', true)");
await as("authenticated", customer);
const split = (await one("select public.place_order($1::jsonb) as r", [payload()])).r;
const splitOrder = await one("select * from public.orders where id = $1", [split.order_id]);
const splitStalls = await rows("select stall_id, subtotal_cents, tax_cents from public.stall_orders where order_id = $1", [split.order_id]);
check(
  "two-stall order: stall tax shares add up to the order tax",
  splitStalls.length === 2 &&
    splitStalls.reduce((a, s) => a + s.tax_cents, 0) === splitOrder.tax_cents &&
    splitOrder.tax_cents === Math.round((splitOrder.item_total_cents * 9.375) / 100) &&
    splitStalls.every((s) => Math.abs(s.tax_cents - (s.subtotal_cents * 9.375) / 100) <= 1),
  JSON.stringify({ order: splitOrder.tax_cents, stalls: splitStalls }),
);

// ---- support messages (0002_support.sql)
const msg = (over = {}) => JSON.stringify({ name: "Test Guest", contact: "guest@example.com", topic: "order", order_no: "os-abcde", message: "My falooda never came.", ...over });
await as("anon");
const sent = (await one("select public.submit_support_request($1::jsonb) as r", [msg()])).r;
check("anyone can send a support message", /^HS-[2-9A-HJ-NP-Z]{5}$/.test(sent.ref_no), sent.ref_no);
check("anon cannot read support messages", /permission denied/.test((await fails("select * from public.support_requests")) ?? ""));
check("empty message rejected", /message_too_short/.test((await fails("select public.submit_support_request($1::jsonb)", [msg({ message: " hi " })])) ?? ""));
check("missing contact rejected", /contact_required/.test((await fails("select public.submit_support_request($1::jsonb)", [msg({ contact: "" })])) ?? ""));
check("unknown topic rejected", /invalid input value/.test((await fails("select public.submit_support_request($1::jsonb)", [msg({ topic: "refund_now" })])) ?? ""));
for (let i = 0; i < 4; i++) await db.query("select public.submit_support_request($1::jsonb)", [msg()]);
check("sixth message in an hour from one contact is refused", /too_many_messages/.test((await fails("select public.submit_support_request($1::jsonb)", [msg()])) ?? ""));
await as("authenticated", customer);
const mine = (await one("select public.submit_support_request($1::jsonb) as r", [msg({ contact: "+14085550101" })])).r;
check("customer cannot read messages, even their own", (await one("select count(*)::int n from public.support_requests")).n === 0);
await fails("update public.support_requests set status = 'closed'");
await as("authenticated", admin);
const stored = await one("select * from public.support_requests where id = $1", [mine.id]);
check("customer cannot edit messages", stored.status === "new");
check("signed-in message is linked to the customer, order number upper-cased", stored.customer_id === customer && stored.order_no === "OS-ABCDE");
await db.query("update public.support_requests set status = 'closed', handled_at = now() where id = $1", [mine.id]);
check("admin reads and closes messages", (await one("select status from public.support_requests where id = $1", [mine.id])).status === "closed");
await db.query("update public.park_settings set contact_email = 'hello@example.com' where id = 1");
await as("anon");
check("park contact fields are public", (await one("select contact_email from public.park_settings where id = 1")).contact_email === "hello@example.com");

// ---- coupons (0005_coupons.sql)
await as("authenticated", admin);
await db.query(`insert into public.coupons (code, title, kind, value, min_order_cents, max_discount_cents) values ('SAVE10', '10% off', 'percent', 10, 1000, 300)`);
await db.query(`insert into public.coupons (code, title, kind, value, stall_id, per_customer_limit) values ('SWEET2', '$2 off desserts', 'amount', 200, 'desi-desserts', 1)`);
await db.query(`insert into public.coupons (code, title, kind, value, show_in_app) values ('SECRET5', 'Staff thanks', 'amount', 500, false)`);
await db.query(`insert into public.coupons (code, title, kind, value, ends_at) values ('OLD', 'Expired', 'amount', 100, now() - interval '1 day')`);
await db.query(`insert into public.coupons (code, title, kind, value, usage_limit) values ('ONCE', 'First order only', 'amount', 100, 1)`);
const park = await one("select tax_percent::float as tax from public.park_settings where id = 1");

await as("anon");
const listed = (await rows("select code from public.coupons order by code")).map((r) => r.code);
check("visitors see listed coupons only", listed.includes("SAVE10") && listed.includes("SWEET2") && !listed.includes("SECRET5") && !listed.includes("OLD"), listed.join(","));
check("visitors cannot create coupons", /permission denied|row-level security/.test((await fails(`insert into public.coupons (code, title, kind, value) values ('HACK', 'x', 'amount', 9999)`)) ?? ""));

await as("authenticated", customer);
const cartItems = JSON.parse(payload()).items;
const prices = Object.fromEntries((await rows("select id, price_cents from public.menu_items")).map((r) => [r.id, r.price_cents]));
const itemTotal = cartItems.reduce((n, l) => n + prices[l.menu_item_id] * l.qty, 0);
const quote = (await one("select public.quote_coupon('save10', $1::jsonb) as q", [JSON.stringify(cartItems)])).q;
check("quote: code is case-insensitive, percent capped at the maximum", quote.code === "SAVE10" && quote.discount_cents === Math.min(Math.round(itemTotal * 0.1), 300), JSON.stringify(quote));
check("hidden code still works when typed", (await one("select public.quote_coupon('SECRET5', $1::jsonb) as q", [JSON.stringify(cartItems)])).q.discount_cents === 500);
check("unknown code rejected", /coupon_not_found/.test((await fails("select public.quote_coupon('NOPE', $1::jsonb)", [JSON.stringify(cartItems)])) ?? ""));
check("expired code rejected", /coupon_expired/.test((await fails("select public.quote_coupon('OLD', $1::jsonb)", [JSON.stringify(cartItems)])) ?? ""));
check("minimum order enforced", /coupon_min_order/.test((await fails("select public.quote_coupon('SAVE10', $1::jsonb)", [JSON.stringify([{ menu_item_id: PULKA, qty: 1 }])])) ?? ""));
check("truck-only coupon needs that truck's dishes", /coupon_not_applicable/.test((await fails("select public.quote_coupon('SWEET2', $1::jsonb)", [JSON.stringify([{ menu_item_id: PULKA, qty: 2 }])])) ?? ""));

const withCoupon = (await one("select public.place_order($1::jsonb) as r", [payload({ coupon_code: "SAVE10" })])).r;
const co = await one("select * from public.orders where id = $1", [withCoupon.order_id]);
const coStalls = await rows("select stall_id, subtotal_cents, discount_cents, tax_cents from public.stall_orders where order_id = $1", [withCoupon.order_id]);
const expectDiscount = Math.min(Math.round(itemTotal * 0.1), 300);
const expectTax = Math.round(((itemTotal - expectDiscount) * park.tax) / 100);
check(
  "order with coupon: discount before tax, totals add up",
  co.coupon_code === "SAVE10" && co.discount_cents === expectDiscount && co.tax_cents === expectTax && co.total_cents === itemTotal - expectDiscount + expectTax,
  JSON.stringify({ d: co.discount_cents, t: co.tax_cents, total: co.total_cents, expectDiscount, expectTax }),
);
check(
  "stall shares of discount and tax add up to the order's",
  coStalls.reduce((n, s) => n + s.discount_cents, 0) === co.discount_cents && coStalls.reduce((n, s) => n + s.tax_cents, 0) === co.tax_cents,
  JSON.stringify(coStalls),
);

const sweet = (await one("select public.place_order($1::jsonb) as r", [payload({ coupon_code: "SWEET2" })])).r;
const sweetStalls = await rows("select stall_id, discount_cents from public.stall_orders where order_id = $1 order by stall_id", [sweet.order_id]);
check(
  "truck-only coupon discounts only that truck's part",
  sweetStalls.find((s) => s.stall_id === "desi-desserts").discount_cents === 200 && sweetStalls.find((s) => s.stall_id === "pandemkodi-dhaba").discount_cents === 0,
  JSON.stringify(sweetStalls),
);
check("per-customer limit enforced", /coupon_already_used/.test((await fails("select public.place_order($1::jsonb)", [payload({ coupon_code: "SWEET2" })])) ?? ""));

await db.query("select public.place_order($1::jsonb)", [payload({ coupon_code: "ONCE" })]);
await as("authenticated", stranger);
check("total usage limit enforced across customers", /coupon_used_up/.test((await fails("select public.place_order($1::jsonb)", [payload({ coupon_code: "ONCE", customer_name: "Other" })])) ?? ""));

await as("authenticated", admin);
await db.query("update public.park_settings set coupons_enabled = false where id = 1");
await as("authenticated", customer);
check("master switch turns coupons off", /coupons_disabled/.test((await fails("select public.quote_coupon('SAVE10', $1::jsonb)", [JSON.stringify(cartItems)])) ?? ""));
const plain = (await one("select public.place_order($1::jsonb) as r", [payload()])).r;
check("orders without a code still work with coupons off", (await one("select discount_cents from public.orders where id = $1", [plain.order_id])).discount_cents === 0);
await as("authenticated", admin);
await db.query("update public.park_settings set coupons_enabled = true where id = 1");

// ---- contract v1.6 (0006_v16.sql)
const err = async (sql, params = []) => (await fails(sql, params)) ?? "";
const place = async (over = {}) => (await one("select public.place_order($1::jsonb) as r", [payload(over)])).r;
const DISH = catalog.menu_items.find((m) => m.stall_id === "pandemkodi-dhaba" && m.id !== PULKA).id;
const SWEET_DISH = FALOODA;

// dish options: a truck sets them up on its own dishes only
await as("authenticated", staff);
const spice = (await one("insert into public.menu_option_groups (menu_item_id, name, min_select, max_select) values ($1, 'Spice level', 1, 1) returning id", [DISH])).id;
const addons = (await one("insert into public.menu_option_groups (menu_item_id, name, min_select, max_select, sort_order) values ($1, 'Add-ons', 0, 2, 1) returning id", [DISH])).id;
const [mild, hot] = (await rows("insert into public.menu_options (group_id, name, price_cents, sort_order) values ($1, 'Mild', 0, 0), ($1, 'Hot', 0, 1) returning id", [spice])).map((r) => r.id);
const [extraPulka, raita, egg] = (await rows("insert into public.menu_options (group_id, name, price_cents, sort_order) values ($1, 'Extra pulka', 199, 0), ($1, 'Raita', 150, 1), ($1, 'Boiled egg', 100, 2) returning id", [addons])).map((r) => r.id);
check("truck staff add options to their own dish", Boolean(spice && addons && mild && extraPulka));
check(
  "truck staff cannot add options to another truck's dish",
  /row-level security|permission denied/.test(await err("insert into public.menu_option_groups (menu_item_id, name) values ($1, 'Size')", [SWEET_DISH])),
);
await db.query("update public.menu_items set description = 'Edited by the truck' where id = $1", [DISH]);
await db.query("update public.menu_items set description = 'Hacked' where id = $1", [SWEET_DISH]);
await as("anon");
check("truck staff edit their own dishes (S4)", (await one("select description from public.menu_items where id = $1", [DISH])).description === "Edited by the truck");
check("…but not another truck's", (await one("select description from public.menu_items where id = $1", [SWEET_DISH])).description !== "Hacked");
check("anyone reads dish options", (await one("select count(*)::int n from public.menu_options")).n === 5);

await as("authenticated", customer);
const base = (await one("select price_cents from public.menu_items where id = $1", [DISH])).price_cents;
const line = (option_ids) => ({ items: [{ menu_item_id: DISH, qty: 2, option_ids }] });
check("required option missing is refused", /option_required/.test(await err("select public.place_order($1::jsonb)", [payload(line([]))])));
check("too many add-ons refused", /too_many_options/.test(await err("select public.place_order($1::jsonb)", [payload(line([hot, extraPulka, raita, egg]))])));
check("option from another dish refused", /bad_options/.test(await err("select public.place_order($1::jsonb)", [payload({ items: [{ menu_item_id: PULKA, qty: 1, option_ids: [hot] }] })])));
check("same option twice refused", /bad_options/.test(await err("select public.place_order($1::jsonb)", [payload(line([hot, hot]))])));
const withOpts = await place(line([hot, extraPulka, raita]));
const optItem = await one("select oi.* from public.order_items oi join public.stall_orders so on so.id = oi.stall_order_id where so.order_id = $1", [withOpts.order_id]);
check("option prices are added to the dish price", optItem.unit_price_cents === base + 199 + 150 && withOpts.total_cents >= 2 * (base + 349), JSON.stringify({ unit: optItem.unit_price_cents, base }));
check(
  "order line keeps a copy of the options chosen",
  optItem.options.length === 3 && optItem.options[0].group === "Spice level" && optItem.options[0].name === "Hot" && optItem.options[1].price_cents === 199,
  JSON.stringify(optItem.options),
);
const optQuote = (await one("select public.quote_coupon('SAVE10', $1::jsonb) as q", [JSON.stringify([{ menu_item_id: DISH, qty: 2, option_ids: [hot, extraPulka] }])])).q;
check("coupon quote counts option prices", optQuote.discount_cents === Math.min(Math.round(2 * (base + 199) * 0.1), 300), JSON.stringify(optQuote));
await as("authenticated", staff);
await db.query("update public.menu_options set is_available = false where id = $1", [raita]);
await as("authenticated", customer);
check("sold-out option refused", /option_unavailable/.test(await err("select public.place_order($1::jsonb)", [payload(line([mild, raita]))])));

// favourites
await db.query("insert into public.favorites (user_id, menu_item_id) values ($1, $2)", [customer, DISH]);
await db.query("insert into public.favorites (user_id, stall_id) values ($1, 'desi-desserts')", [customer]);
check("customer saves a dish and a truck", (await one("select count(*)::int n from public.favorites")).n === 2);
check("saving the same dish twice is refused", /duplicate|unique/.test(await err("insert into public.favorites (user_id, menu_item_id) values ($1, $2)", [customer, DISH])));
check("a favourite is a dish or a truck, not both", /check/.test(await err("insert into public.favorites (user_id, menu_item_id, stall_id) values ($1, $2, 'desi-desserts')", [customer, PULKA])));
check("cannot save favourites for someone else", /row-level security/.test(await err("insert into public.favorites (user_id, menu_item_id) values ($1, $2)", [stranger, PULKA])));
await as("authenticated", stranger);
check("favourites are private", (await one("select count(*)::int n from public.favorites")).n === 0);

// pause and opening hours
check("only that truck's staff can pause it", /forbidden/.test(await err("select public.pause_stall('pandemkodi-dhaba', 15)")));
await as("authenticated", staff);
await db.query("select public.pause_stall('pandemkodi-dhaba', 15)");
await as("anon");
const pausedRow = await one("select * from public.stall_status() where stall_id = 'pandemkodi-dhaba'");
check("stall_status shows the pause", pausedRow.accepting === false && pausedRow.reason === "paused" && pausedRow.paused_until !== null);
await as("authenticated", customer);
check("paused truck refuses orders", /stall_paused/.test(await err("select public.place_order($1::jsonb)", [payload()])));
await as("authenticated", staff);
await db.query("select public.pause_stall('pandemkodi-dhaba', 0)");
check("pause longer than 4 hours refused", /bad_minutes/.test(await err("select public.pause_stall('pandemkodi-dhaba', 600)")));

const hNow = (await one("select extract(hour from now() at time zone 'America/Los_Angeles')::int h")).h;
const hh = (h) => `${String(((h % 24) + 24) % 24).padStart(2, "0")}:00`;
const week = (opens, closes) => JSON.stringify([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes })));
await db.query("select public.set_stall_hours('pandemkodi-dhaba', true, $1::jsonb)", [week(hh(hNow + 2), hh(hNow + 3))]);
await as("authenticated", customer);
check("outside opening hours refuses orders", /outside_hours/.test(await err("select public.place_order($1::jsonb)", [payload()])));
await as("authenticated", staff);
await db.query("select public.set_stall_hours('pandemkodi-dhaba', true, $1::jsonb)", [week(hh(hNow), hh(hNow + 1))]);
await as("authenticated", customer);
check("inside opening hours takes orders (hours past midnight too)", Boolean((await place()).order_id));
await as("authenticated", staff);
check("bad hours refused", /bad_hours/.test(await err("select public.set_stall_hours('pandemkodi-dhaba', true, '[{\"weekday\":1,\"opens\":\"25:00\",\"closes\":\"26:00\"}]'::jsonb)")));
check("auto hours with no hours refused", /bad_hours/.test(await err("select public.set_stall_hours('pandemkodi-dhaba', true, '[]'::jsonb)")));
await db.query("select public.set_stall_hours('pandemkodi-dhaba', false, '[]'::jsonb)");

// prep time on accept
await as("authenticated", customer);
const prepOrder = await place();
const prepTicket = await one("select id from public.stall_orders where order_id = $1 and stall_id = 'pandemkodi-dhaba'", [prepOrder.order_id]);
await as("authenticated", staff);
check("prep time over 2 hours refused", /bad_prep_time/.test(await err("select public.set_stall_order_status($1, 'preparing', 500)", [prepTicket.id])));
await db.query("select public.set_stall_order_status($1, 'preparing', 12)", [prepTicket.id]);
const accepted = await one("select prep_mins, extract(epoch from ready_by - accepted_at)::int s from public.stall_orders where id = $1", [prepTicket.id]);
check("accepting with a prep time sets ready_by", accepted.prep_mins === 12 && accepted.s === 720, JSON.stringify(accepted));
await db.query("select public.set_stall_order_status($1, 'ready')", [prepTicket.id]);
check("two-argument status calls still work", (await one("select status from public.stall_orders where id = $1", [prepTicket.id])).status === "ready");

// ratings
await as("authenticated", customer);
check("cannot rate before pickup", /not_completed/.test(await err("select public.rate_stall_order($1, 5, 'x')", [prepTicket.id])));
await as("authenticated", staff);
await db.query("select public.set_stall_order_status($1, 'completed')", [prepTicket.id]);
await as("authenticated", stranger);
check("cannot rate someone else's order", /not_found/.test(await err("select public.rate_stall_order($1, 1, 'bad')", [prepTicket.id])));
await as("authenticated", customer);
check("stars must be 1–5", /bad_rating/.test(await err("select public.rate_stall_order($1, 6, null)", [prepTicket.id])));
await db.query("select public.rate_stall_order($1, 4, 'Good pulka')", [prepTicket.id]);
await db.query("select public.rate_stall_order($1, 5, 'Great pulka')", [prepTicket.id]);
const myRating = await one("select stars, comment from public.order_ratings where stall_order_id = $1", [prepTicket.id]);
check("rating again updates the same rating", myRating.stars === 5 && myRating.comment === "Great pulka");
await as("anon");
check("ratings stay private while ratings_public is off", (await rows("select * from public.stall_rating_summary()")).length === 0);
await as("authenticated", staff);
const staffSummary = await rows("select * from public.stall_rating_summary()");
check("a truck sees its own ratings", staffSummary.length === 1 && staffSummary[0].stall_id === "pandemkodi-dhaba" && Number(staffSummary[0].avg_stars) === 5);
check("a truck reads its comments", (await one("select count(*)::int n from public.order_ratings")).n === 1);
await as("authenticated", admin);
await db.query("update public.park_settings set ratings_public = true where id = 1");
await as("anon");
check("ratings show to everyone once the owner turns them on", (await rows("select * from public.stall_rating_summary()")).length === 1);
await as("authenticated", admin);
await db.query("update public.park_settings set ratings_public = false where id = 1");

// refunds
await as("authenticated", customer);
const paidOrder = await place({ payment_method: "online", tip_cents: 100 });
await as("authenticated", admin);
check("unpaid order is not refundable", /not_refundable/.test(await err("select public.request_refund($1, null, 100, 'x')", [paidOrder.order_id])));
await as("service_role");
await db.query("select public.mark_order_paid($1, 'pi_test')", [paidOrder.order_id]);
const paidTickets = await rows("select id, stall_id, subtotal_cents - discount_cents + tax_cents due from public.stall_orders where order_id = $1 order by stall_id", [paidOrder.order_id]);
const pkPaid = paidTickets.find((t) => t.stall_id === "pandemkodi-dhaba");
const ddPaid = paidTickets.find((t) => t.stall_id === "desi-desserts");
await as("authenticated", staff);
await db.query("select public.set_stall_order_status($1, 'cancelled')", [pkPaid.id]);
await as("authenticated", customer);
const r1 = await rows("select * from public.refunds where order_id = $1", [paidOrder.order_id]);
check("truck rejecting a paid order queues a refund for its part", r1.length === 1 && r1[0].amount_cents === pkPaid.due && r1[0].status === "pending" && r1[0].stall_order_id === pkPaid.id, JSON.stringify(r1));
await as("authenticated", admin);
await db.query("select public.set_stall_order_status($1, 'cancelled')", [ddPaid.id]);
const r2 = await rows("select * from public.refunds where order_id = $1 order by created_at, amount_cents", [paidOrder.order_id]);
const total2 = (await one("select total_cents from public.orders where id = $1", [paidOrder.order_id])).total_cents;
check("every truck rejected: refunds add up to the full total, tip included", r2.reduce((n, r) => n + r.amount_cents, 0) === total2 && r2.length === 3, JSON.stringify(r2.map((r) => r.amount_cents)));
check("cannot refund more than was paid", /bad_amount/.test(await err("select public.request_refund($1, null, 1, 'more')", [paidOrder.order_id])));
await as("authenticated", customer);
check("customer cannot record refund results", /permission denied/.test(await err("select public.record_refund_result($1, true, 're_x', null)", [r2[0].id])));
await as("service_role");
for (const r of r2) await db.query("select public.record_refund_result($1, true, $2, null)", [r.id, `re_${r.amount_cents}`]);
const refundedOrder = await one("select payment_status, refunded_cents from public.orders where id = $1", [paidOrder.order_id]);
check("all refunds sent: order shows refunded", refundedOrder.payment_status === "refunded" && refundedOrder.refunded_cents === total2, JSON.stringify(refundedOrder));

await as("authenticated", customer);
const partOrder = await place({ payment_method: "online" });
await as("service_role");
await db.query("select public.mark_order_paid($1, 'pi_test2')", [partOrder.order_id]);
await as("authenticated", admin);
const partId = (await one("select public.request_refund($1, null, 150, 'Missing raita') as id", [partOrder.order_id])).id;
await as("service_role");
await db.query("select public.record_refund_result($1, false, null, 'card_declined')", [partId]);
const partRow = await one("select status, error from public.refunds where id = $1", [partId]);
const partPaid = await one("select payment_status, refunded_cents from public.orders where id = $1", [partOrder.order_id]);
check("failed refund is recorded and leaves the order paid", partRow.status === "failed" && partRow.error === "card_declined" && partPaid.payment_status === "paid" && partPaid.refunded_cents === 0);
await as("authenticated", customer);
await db.query("select public.cancel_order($1)", [partOrder.order_id]);
const cancelRefund = await rows("select amount_cents from public.refunds where order_id = $1 and status = 'pending'", [partOrder.order_id]);
check("customer cancelling a paid order queues a full refund", cancelRefund.length === 1 && cancelRefund[0].amount_cents === partOrder.total_cents, JSON.stringify(cancelRefund));
await as("authenticated", stranger);
check("refunds are private to the order's customer", (await one("select count(*)::int n from public.refunds")).n === 0);

// order for later
await as("authenticated", customer);
const soon = (mins) => new Date(Date.now() + mins * 60000).toISOString();
check("ordering for later is off by default", /scheduling_unavailable/.test(await err("select public.place_order($1::jsonb)", [payload({ pickup_at: soon(30) })])));
await as("authenticated", admin);
await db.query("update public.park_settings set scheduled_orders_enabled = true where id = 1");
await as("authenticated", customer);
check("pickup time too soon refused", /bad_pickup_time/.test(await err("select public.place_order($1::jsonb)", [payload({ pickup_at: soon(3) })])));
check("pickup time unreadable refused", /bad_pickup_time/.test(await err("select public.place_order($1::jsonb)", [payload({ pickup_at: "tonight" })])));
const sameDay = (await one("select ((now() + interval '15 minutes') at time zone 'America/Los_Angeles')::date = (now() at time zone 'America/Los_Angeles')::date ok")).ok;
if (sameDay) {
  const later = await place({ pickup_at: soon(15) });
  check("order for later keeps its pickup time", (await one("select pickup_at from public.orders where id = $1", [later.order_id])).pickup_at !== null);
} else {
  check("order for later keeps its pickup time (skipped near midnight)", true);
}
await as("authenticated", admin);
await db.query("update public.park_settings set scheduled_orders_enabled = false where id = 1");

// phones to notify
await as("anon");
check("visitors cannot register a phone", /permission denied|sign_in_required/.test(await err("select public.register_device('tok_1234567890', 'android')")));
await as("authenticated", customer);
await db.query("select public.register_device('tok_1234567890', 'android')");
check("customer registers a phone", (await one("select count(*)::int n from public.device_tokens")).n === 1);
check("bad platform refused", /bad_device/.test(await err("select public.register_device('tok_abcdefghij', 'blackberry')")));
await as("authenticated", stranger);
await db.query("select public.register_device('tok_1234567890', 'android')");
check("a phone moves to whoever signed in on it last", (await one("select count(*)::int n from public.device_tokens")).n === 1);
await as("authenticated", customer);
check("phones are private", (await one("select count(*)::int n from public.device_tokens")).n === 0);

// reports
const today = (await one("select (now() at time zone 'America/Los_Angeles')::date::text d")).d;
await as("authenticated", admin);
const sales = await rows("select * from public.report_sales($1::date, $1::date)", [today]);
const expectCharged = (await one("select coalesce(sum(subtotal_cents - discount_cents + tax_cents), 0)::int n from public.stall_orders where status not in ('pending', 'cancelled')")).n;
check("sales report adds up to what trucks charged", sales.length > 0 && sales.reduce((n, r) => n + r.charged_cents, 0) === expectCharged, `${sales.reduce((n, r) => n + r.charged_cents, 0)} vs ${expectCharged}`);
check("sales report splits online and at-truck", sales.every((r) => r.online_cents + r.at_stall_cents === r.charged_cents));
const items = await rows("select * from public.report_items($1::date, $1::date)", [today]);
check("dish report lists best sellers first", items.length > 0 && items.every((r, i) => i === 0 || items[i - 1].qty >= r.qty));
check("busiest hours report has rows", (await rows("select * from public.report_hours($1::date, $1::date)", [today])).length > 0);
check("report range over a year refused", /bad_range/.test(await err("select * from public.report_sales('2020-01-01', '2026-01-01')")));
await as("authenticated", staff);
check("a truck sees its own numbers", (await rows("select * from public.report_sales($1::date, $1::date, 'pandemkodi-dhaba')", [today])).every((r) => r.stall_id === "pandemkodi-dhaba"));
check("a truck cannot see another truck's numbers", /forbidden/.test(await err("select * from public.report_sales($1::date, $1::date, 'desi-desserts')", [today])));
check("a truck cannot see the whole park", /forbidden/.test(await err("select * from public.report_sales($1::date, $1::date)", [today])));
await as("authenticated", customer);
check("customers cannot see reports", /forbidden/.test(await err("select * from public.report_items($1::date, $1::date)", [today])));

// wait times
await as("anon");
const waits = await rows("select * from public.stall_wait_times()");
check("wait times: one row per truck, no guess without enough tickets", waits.length === catalog.stalls.length && waits.every((w) => w.typical_prep_mins === null));

// ---- popular dishes (0007_popular.sql)
await as("anon");
const popular = await rows("select * from public.popular_items(5)");
check("popular dishes come from real orders, at least 3 each", popular.length > 0 && popular.length <= 5 && popular.every((p) => p.orders >= 3), JSON.stringify(popular));
check("popular dishes: limit is capped", (await rows("select * from public.popular_items(999)")).length <= 20);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
