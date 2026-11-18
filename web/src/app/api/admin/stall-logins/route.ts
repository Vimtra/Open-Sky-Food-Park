// One login per stall, managed by the park admin (Admin → Stalls → Stall login).
// Needs the Supabase service key, so it runs here on the server, never in the browser.
//
//   GET  /api/admin/stall-logins            -> [{ stall_id, login }]
//   POST /api/admin/stall-logins            { stall_id, email, password } -> { ok: true }
//   Authorization: Bearer <the admin's Supabase access token>
//
// POST creates the account (or resets its password when the email already exists), makes it
// stall staff, links it to that stall only, and unlinks any previous login of that stall.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const fail = (status: number, error: string) => Response.json({ error }, { status });

async function adminClient(request: Request): Promise<SupabaseClient | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return fail(503, "Stall logins need the Supabase keys on the server (see DEPLOY.md).");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "sign_in_required");

  // Check the caller is a park admin, reading their own profile as themselves.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user } = await asCaller.auth.getUser(token);
  if (!user.user) return fail(401, "sign_in_required");
  const { data: profile } = await asCaller.from("profiles").select("role").eq("id", user.user.id).maybeSingle();
  if (profile?.role !== "admin") return fail(403, "forbidden");

  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function findUserByEmail(db: SupabaseClient, email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit || data.users.length < 200) return hit ?? null;
  }
  return null;
}

export async function GET(request: Request) {
  const db = await adminClient(request);
  if (db instanceof Response) return db;

  const [{ data: stalls, error: e1 }, { data: links, error: e2 }] = await Promise.all([
    db.from("stalls").select("id").order("sort_order"),
    db.from("stall_staff").select("stall_id, user_id"),
  ]);
  if (e1 || e2) return fail(500, "Could not read the stalls.");

  const emails = new Map<string, string>();
  for (const l of links ?? []) {
    if (emails.has(l.user_id)) continue;
    const { data } = await db.auth.admin.getUserById(l.user_id);
    if (data.user?.email) emails.set(l.user_id, data.user.email);
  }
  return Response.json(
    (stalls ?? []).map((s) => {
      const link = (links ?? []).find((l) => l.stall_id === s.id && emails.has(l.user_id));
      return { stall_id: s.id, login: link ? emails.get(link.user_id) : null };
    }),
  );
}

export async function POST(request: Request) {
  const db = await adminClient(request);
  if (db instanceof Response) return db;

  const body = (await request.json().catch(() => null)) as { stall_id?: unknown; email?: unknown; password?: unknown } | null;
  const stallId = typeof body?.stall_id === "string" ? body.stall_id : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!stallId) return fail(400, "Choose a stall.");
  if (!EMAIL.test(email)) return fail(400, "Enter a valid email for the login.");
  if (password.length < 8) return fail(400, "Use a password of at least 8 characters.");

  const { data: stall } = await db.from("stalls").select("id").eq("id", stallId).maybeSingle();
  if (!stall) return fail(404, "not_found");

  try {
    let user = await findUserByEmail(db, email);
    if (user) {
      const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role === "admin") return fail(409, "That email is the park admin's account. Use a different email for the stall.");
      const { data: other } = await db.from("stall_staff").select("stall_id").eq("user_id", user.id).neq("stall_id", stallId);
      if (other?.length) return fail(409, "login_taken");
      const { error } = await db.auth.admin.updateUserById(user.id, { password });
      if (error) return fail(400, error.message);
    } else {
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return fail(400, error?.message ?? "Could not create the login.");
      user = data.user;
    }

    const { error: pe } = await db.from("profiles").upsert({ id: user.id, role: "stall_staff" }, { onConflict: "id" });
    if (pe) return fail(500, "Could not set the role.");
    // One login per stall: unlink the previous one, link this one.
    await db.from("stall_staff").delete().eq("stall_id", stallId).neq("user_id", user.id);
    const { error: le } = await db.from("stall_staff").upsert({ stall_id: stallId, user_id: user.id });
    if (le) return fail(500, "Could not link the stall.");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("stall login failed", err);
    return fail(500, "Could not save the stall login.");
  }
}
