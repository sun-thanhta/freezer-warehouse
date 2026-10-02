"use client";

import { useState } from "react";
import { ErrorBox, Loading } from "@/components/async-state";
import { ProductExpiryRow, ZoneThresholdRow, type SettingsProduct, type SettingsZone } from "@/components/settings-rows";
import { Card, PageHeader, TableShell } from "@/components/ui-primitives";
import { useApi } from "@/lib/client/use-api";

export default function SettingsPage() {
  const { data, error, loading, reload } = useApi<{ zones: SettingsZone[]; products: SettingsProduct[] }>("/api/settings");
  const { data: me } = useApi<{ role: string }>("/api/me");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canEdit = me?.role === "manager";
  const done = (ok: boolean, text: string) => { setMsg({ ok, text }); if (ok) reload(); };

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Không có dữ liệu"} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Cấu hình nghiệp vụ" subtitle="SCR-32 / SCR-02 · Mọi kiểm tra nhiệt (nhập / xuất) và quyết định hạn dùng đều đọc cấu hình này" />
      {!canEdit && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Bạn đang xem ở quyền nhân viên kho — chỉ tài khoản quản lý được sửa.</p>}
      {msg && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <Card title="Ngưỡng 3 dải nhiệt (三温度帯) — do Yuki TỰ công bố (R-01, BR-TEMP-01)" className="mb-6">
        <p className="mb-3 text-xs text-slate-500">Không theo một chuẩn chung; để trống = không giới hạn phía đó. Mỗi thay đổi ghi audit (trước → sau).</p>
        <TableShell>
          <thead><tr><th>Dải nhiệt</th><th>Min (°C)</th><th>Max (°C)</th><th></th></tr></thead>
          <tbody>{data.zones.map((z) => <ZoneThresholdRow key={z.id} zone={z} canEdit={canEdit} onDone={done} />)}</tbody>
        </TableShell>
      </Card>

      <Card title="Master 12 SKU — loại hạn dùng (BR-EXP-01) & lane truy xuất">
        <p className="mb-3 text-xs text-slate-500">
          賞味期限 = hạn ngon nhất (best-before) → chỉ cảnh báo. 消費期限 = hạn tiêu thụ an toàn (use-by) → HARD STOP khi đến/quá hạn (BR-EXP-02). Thay đổi được ghi audit log.
        </p>
        <TableShell>
          <thead><tr><th>SKU</th><th>Dải nhiệt</th><th>Truy xuất</th><th>Loại hạn</th><th>Cận hạn (ngày)</th><th></th></tr></thead>
          <tbody>{data.products.map((p) => <ProductExpiryRow key={p.id} product={p} zones={data.zones} canEdit={canEdit} onDone={done} />)}</tbody>
        </TableShell>
      </Card>
    </>
  );
}
