// Public Supabase config. Both values are safe to expose to the browser (RLS protects data).
// Accepts the new publishable key (sb_publishable_…) or the legacy anon key. NEXT_PUBLIC_* must be
// referenced literally so Next.js can inline them into the client bundle at build time.

export function getPublicSupabaseKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = getPublicSupabaseKey();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const MISSING_ENV_MESSAGE =
  "Chưa cấu hình Supabase: đặt NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY) trong .env.local / Vercel env.";
