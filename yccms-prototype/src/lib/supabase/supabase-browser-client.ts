"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseKey } from "./supabase-env";

/** Browser client — used only for sign-in / sign-out. All data goes through /api routes. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, getPublicSupabaseKey()!);
}
