"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/supabase-browser-client";
import { useApi } from "@/lib/client/use-api";

export interface Me { email: string; full_name: string; roles: string[] }

export function AppHeader() {
  const router = useRouter();
  const { data: me } = useApi<Me>("/api/me");

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white sm:px-8">
      <Link href="/" className="font-semibold">YCCMS · Yuki</Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-slate-300 sm:inline">{me ? `${me.full_name} · ${me.roles.join(", ")}` : "…"}</span>
        <button onClick={signOut} className="rounded border border-white/30 px-2 py-1 text-xs hover:bg-white/10">Đăng xuất</button>
      </div>
    </header>
  );
}
