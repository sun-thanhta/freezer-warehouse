"use client";

import { useState } from "react";
import { Empty, ErrorBox, Loading } from "@/components/async-state";
import { Card, PageHeader, TableShell } from "@/components/ui-primitives";
import { fmtDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Log { id: number; actor_email: string | null; action: string; entity: string; entity_id: string | null; detail: unknown; created_at: string }
const FILTERS = ["", "inbound", "outbound", "override", "quarantine", "customer_sku_agreements", "temperature_zones", "products", "seed"];

export default function AuditPage() {
  const [action, setAction] = useState("");
  const { data, error, loading, reload } = useApi<{ logs: Log[] }>(`/api/audit${action ? `?action=${action}` : ""}`);
  return (
    <>
      <PageHeader title="Audit log" subtitle="SCR-34 · Ai / khi nào / thay đổi gì — append-only, người thực hiện do server đóng dấu (NFR-AUD-01)" />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setAction(f)} className={`rounded-lg px-3 py-1.5 text-sm ${action === f ? "bg-sky-700 text-white" : "border border-slate-300 bg-white"}`}>{f || "Tất cả"}</button>
        ))}
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <Card>
          {data?.logs.length === 0 ? <Empty>Không có bản ghi.</Empty> : (
            <TableShell>
              <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
              <tbody>
                {data?.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDateTime(l.created_at)}</td>
                    <td className="text-xs">{l.actor_email ?? "—"}</td>
                    <td><code className="text-xs text-sky-800">{l.action}</code></td>
                    <td className="text-xs">{l.entity}{l.entity_id && <div className="font-mono text-slate-400">{l.entity_id.slice(0, 8)}</div>}</td>
                    <td><pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">{JSON.stringify(l.detail)}</pre></td>
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
