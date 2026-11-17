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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
