"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Field, inputClass } from "@/components/ui-primitives";
import { createSupabaseBrowserClient } from "@/lib/supabase/supabase-browser-client";
import { DB_UNREACHABLE_MESSAGE, isConnectivityError } from "@/lib/supabase/supabase-connectivity";

const PARAM_ERRORS: Record<string, string> = {
  config: "Ứng dụng chưa được cấu hình Supabase (thiếu biến môi trường).",
  db: DB_UNREACHABLE_MESSAGE,
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(PARAM_ERRORS[params.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (authError) {
        if (isConnectivityError(authError)) { setError(DB_UNREACHABLE_MESSAGE); return; }
        setError(authError.message === "Invalid login credentials" ? "Sai email hoặc mật khẩu." : authError.message);
        return;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch {
      setError(DB_UNREACHABLE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <Field label="Email">
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Mật khẩu">
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </Field>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
      <p className="text-center text-xs text-slate-500">Tài khoản demo: xem README.md của repo.</p>
    </form>
  );
}
