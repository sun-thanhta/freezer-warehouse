import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv, MISSING_ENV_MESSAGE } from "./supabase-env";

/** Per-request Supabase client bound to the caller's auth cookies (RLS runs as that user). */
export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error(MISSING_ENV_MESSAGE);
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a context that cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
