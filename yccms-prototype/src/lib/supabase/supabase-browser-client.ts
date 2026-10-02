"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client — used only for sign-in / sign-out. All data goes through /api routes. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
