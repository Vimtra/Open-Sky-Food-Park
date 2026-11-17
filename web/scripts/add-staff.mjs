// Creates or promotes a park admin or a stall staff account in the real Supabase project.
// Run from web/ after .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
//
//   npm run staff:add -- --email you@gmail.com --role admin
//   npm run staff:add -- --email cook@example.com --role stall_staff --stall pandemkodi-dhaba
//
// If the email already has an account (for example someone who signed in with Google),
// it is only given the role. Otherwise you are asked to choose a password for the new
// account, which then signs in with email + password on /admin or /partner.
// The service-role key never leaves this machine.

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    role: { type: "string", default: "admin" },
    stall: { type: "string" },
  },
});

const fail = (msg) => {
  console.error(`\n${msg}\n`);
  process.exit(1);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env.local first.");

const email = values.email?.trim().toLowerCase();
if (!email || !email.includes("@")) fail("Pass --email you@example.com");
const role = values.role;
if (role !== "admin" && role !== "stall_staff") fail("--role must be admin or stall_staff");
if (role === "stall_staff" && !values.stall) fail("Stall staff need --stall <stall id>, e.g. --stall pandemkodi-dhaba");

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(address) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === address);
    if (hit || data.users.length < 200) return hit ?? null;
  }
  return null;
}

async function askPassword() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pw = await rl.question("Choose a password for this account (at least 10 characters): ");
  const again = await rl.question("Type it again: ");
  rl.close();
  if (pw !== again) fail("The two passwords did not match.");
  if (pw.length < 10) fail("Use at least 10 characters.");
  return pw;
}

if (values.stall) {
  const { data: stall } = await db.from("stalls").select("id,name").eq("id", values.stall).maybeSingle();
  if (!stall) fail(`No stall with id "${values.stall}". Ids are like pandemkodi-dhaba, desi-desserts.`);
}

let user = await findUser(email);
if (user) {
  console.log(`Found an existing account for ${email}.`);
} else {
  const password = await askPassword();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) fail(`Could not create the account: ${error.message}`);
  user = data.user;
  console.log(`Created ${email}.`);
}

// The profile row is created by a trigger on sign-up; make sure it exists, then set the role.
const { error: profileError } = await db.from("profiles").upsert({ id: user.id, role }, { onConflict: "id" });
if (profileError) fail(`Could not set the role: ${profileError.message}`);

if (role === "stall_staff") {
  const { error } = await db.from("stall_staff").upsert({ stall_id: values.stall, user_id: user.id });
  if (error) fail(`Could not link the stall: ${error.message}`);
}

console.log(
  role === "admin"
    ? `${email} is now a park admin. Sign in at /admin.`
    : `${email} now runs ${values.stall}. Sign in at /partner.`,
);
