import { NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/supabase-env";

// Liveness for local dev / ops: is the Supabase stack reachable? Public on purpose — returns no data.
export async function GET() {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.json({ status: "misconfigured", supabase: "missing env" }, { status: 503 });
  try {
    const res = await fetch(`${env.url}/auth/v1/health`, { headers: { apikey: env.anonKey }, cache: "no-store" });
    const ok = res.ok;
    return NextResponse.json({ status: ok ? "ok" : "degraded", supabase: ok ? "up" : `auth ${res.status}` }, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ status: "down", supabase: "unreachable" }, { status: 503 });
  }
}
