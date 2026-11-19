// Server-only helper for admin routes: checks the caller is a park admin, then returns a
// Supabase client with the service key. Never import this from browser code.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function adminClient(request: Request): Promise<SupabaseClient | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return fail(503, "This needs the Supabase keys on the server (see DEPLOY.md).");

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
