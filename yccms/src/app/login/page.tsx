import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="text-xs font-medium uppercase tracking-widest text-sky-300">SCR-00</div>
          <h1 className="mt-1 text-2xl font-semibold">Yuki Cold-Chain Management System</h1>
          <p className="mt-1 text-sm text-slate-300">ユキコールドロジスティクス株式会社 — đăng nhập để tiếp tục</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
