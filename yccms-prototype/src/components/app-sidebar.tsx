"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/supabase-browser-client";
import { useApi } from "@/lib/client/use-api";

const NAV = [
  { group: "Vận hành", items: [
    { href: "/", label: "Tổng quan", code: "SCR-01" },
    { href: "/inbound", label: "Nhập kho & kiểm hàng", code: "SCR-07" },
    { href: "/outbound", label: "Xuất kho & allocation", code: "SCR-12/13" },
    { href: "/alerts", label: "Cảnh báo 日付逆転", code: "SCR-05" },
    { href: "/inventory", label: "Tồn kho & 隔離", code: "SCR-08/10" },
  ]},
  { group: "Khách hàng & truy xuất", items: [
    { href: "/customers", label: "Hợp đồng khách-SKU", code: "SCR-03" },
    { href: "/trace", label: "Truy xuất nguồn gốc", code: "SCR-27" },
  ]},
  { group: "Quản trị", items: [
    { href: "/settings", label: "Ngưỡng nhiệt & SKU", code: "SCR-32/02" },
    { href: "/audit", label: "Audit log", code: "SCR-34" },
  ]},
];

const ROLE_LABEL: Record<string, string> = { warehouse: "Nhân viên kho", manager: "Quản lý" };

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: me } = useApi<{ email: string; full_name: string; role: string }>("/api/me");

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">YCCMS · Yuki</span>
        <button onClick={() => setOpen(!open)} className="rounded border border-white/30 px-2 py-1 text-sm" aria-expanded={open}>Menu</button>
      </div>
      <aside className={`${open ? "block" : "hidden"} w-full shrink-0 bg-slate-900 text-slate-200 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:overflow-y-auto`}>
        <div className="hidden px-5 pb-4 pt-6 lg:block">
          <div className="text-xs font-medium uppercase tracking-widest text-sky-300">Prototype</div>
          <div className="text-lg font-semibold text-white">YCCMS</div>
          <div className="text-xs text-slate-400">ユキコールドロジスティクス · kho lạnh 3 dải nhiệt</div>
        </div>
        <nav className="space-y-5 px-3 py-3">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.group}</div>
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-2 py-2 text-sm ${isActive(item.href) ? "bg-sky-700 text-white" : "hover:bg-slate-800"}`}>
                  <span>{item.label}</span>
                  <span className="text-[10px] text-slate-400">{item.code}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="mx-3 mb-4 mt-2 rounded-lg bg-slate-800 p-3 text-xs">
          <div className="font-medium text-white">{me?.full_name ?? "…"}</div>
          <div className="text-slate-400">{me?.email}</div>
          <div className="mt-1 text-sky-300">{me ? ROLE_LABEL[me.role] ?? me.role : ""}</div>
          <button onClick={signOut} className="mt-2 w-full rounded border border-slate-600 py-1 text-slate-200 hover:bg-slate-700">Đăng xuất</button>
        </div>
      </aside>
    </>
  );
}
