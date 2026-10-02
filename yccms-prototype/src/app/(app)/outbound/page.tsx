"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, ErrorBox, Loading } from "@/components/async-state";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui-primitives";
import { fmtDate } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Order {
  id: string; code: string; ship_date: string; status: "open" | "shipped";
  customer: { code: string; name: string };
  lineCount: number; totalQty: number; reversalLines: number; shortLines: number; reviewLines: number; excludedLots: number; pendingOverride: boolean;
}

export default function OutboundListPage() {
  const [tab, setTab] = useState<"open" | "shipped">("open");
  const { data, error, loading, reload } = useApi<{ orders: Order[] }>("/api/outbound");
  const orders = (data?.orders ?? []).filter((o) => o.status === tab);

  return (
    <>
      <PageHeader title="Đơn xuất kho" subtitle="SCR-12 · Đơn từ retailer — mỗi đơn được kiểm trước theo chuỗi loại trừ FR-OUT-02 (消費期限 → dải nhiệt → 隔離 → window → 日付逆転 → FEFO)" />
      <div className="mb-4 flex gap-2">
        {(["open", "shipped"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-sky-700 text-white" : "border border-slate-300 bg-white"}`}>
            {t === "open" ? "Chờ xuất" : "Đã giao"}
          </button>
        ))}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <Card>
          {orders.length === 0 ? <Empty>Không có đơn.</Empty> : (
            <TableShell>
              <thead><tr><th>Mã đơn</th><th>Ngày giao</th><th>Khách hàng</th><th>Dòng / SL</th><th>Kiểm tra trước khi giao</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td><Link href={`/outbound/${o.id}`} className="font-medium text-sky-700 hover:underline">{o.code}</Link></td>
                    <td>{fmtDate(o.ship_date)}</td>
                    <td><span className="text-xs text-slate-500">{o.customer.code}</span> {o.customer.name}</td>
                    <td className="tabular-nums">{o.lineCount} / {o.totalQty}</td>
                    <td className="space-x-1">
                      {o.status === "shipped" && <Badge tone="green">Đã giao</Badge>}
                      {o.reversalLines > 0 && <Badge tone="red">{o.reversalLines} dòng chặn 日付逆転</Badge>}
                      {o.pendingOverride && <Badge tone="violet">Chờ duyệt ngoại lệ</Badge>}
                      {o.shortLines > 0 && <Badge tone="amber">{o.shortLines} dòng thiếu lô hợp lệ</Badge>}
                      {o.reviewLines > 0 && <Badge tone="amber">{o.reviewLines} hợp đồng chưa chốt window</Badge>}
                      {o.excludedLots > 0 && <Badge tone="gray">{o.excludedLots} lô bị loại</Badge>}
                      {o.status === "open" && o.reversalLines + o.shortLines === 0 && !o.pendingOverride && <Badge tone="green">Giao được</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      )}
    </>
  );
}
