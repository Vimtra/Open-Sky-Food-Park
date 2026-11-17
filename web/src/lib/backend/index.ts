import { createDemoBackend } from "./demo";
import { createSupabaseBackend } from "./supabase";
import type { Backend } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when no Supabase project is configured and the app runs on seed data in the browser. */
export const isDemo = !(url && anonKey);

export type SignInMethod = "google" | "phone";

/**
 * Customer sign-in options, from NEXT_PUBLIC_SIGNIN_METHODS ("google,phone" by default).
 * Turn phone off until an SMS provider is set up in Supabase: NEXT_PUBLIC_SIGNIN_METHODS=google
 */
export const signInMethods: SignInMethod[] = (() => {
  const raw = (process.env.NEXT_PUBLIC_SIGNIN_METHODS ?? "google,phone").toLowerCase();
  const picked = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SignInMethod => s === "google" || s === "phone");
  return picked.length ? picked : ["google", "phone"];
})();

let instance: Backend | null = null;

/** Browser-only. Call from effects, event handlers and SWR fetchers, never during server render. */
export function backend(): Backend {
  if (!instance) instance = isDemo ? createDemoBackend() : createSupabaseBackend(url!, anonKey!);
  return instance;
}

export * from "./types";
