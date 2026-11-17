import { createDemoBackend } from "./demo";
import { createSupabaseBackend } from "./supabase";
import type { Backend } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when no Supabase project is configured and the app runs on seed data in the browser. */
export const isDemo = !(url && anonKey);

let instance: Backend | null = null;

/** Browser-only. Call from effects, event handlers and SWR fetchers, never during server render. */
export function backend(): Backend {
  if (!instance) instance = isDemo ? createDemoBackend() : createSupabaseBackend(url!, anonKey!);
  return instance;
}

export * from "./types";
