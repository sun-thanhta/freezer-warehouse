"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorBox, Loading } from "@/components/async-state";
import { Badge, Card, PageHeader, TableShell, inputClass } from "@/components/ui-primitives";
import { EXPIRY_SHORT, fmtDate, fmtDateTime } from "@/lib/client/format";
import { WINDOW_LABEL, type WindowRule } from "@/lib/rules/delivery-window-rules";
import { ApiClientError, apiSend, useApi } from "@/lib/client/use-api";

interface Agreement {
  id: number; code: string; delivery_term: string; window_rule: WindowRule | null; effective_from: string;
  product: { sku: string; name: string; expiry_type: string };
}
interface Customer { id: number; code: string; name: string; deliveries: number; lastDeliveredAt: string | null; agreements: Agreement[] }

export default function CustomersPage() {
  const { data, error, loading, reload } = useApi<{ customers: Customer[] }>("/api/customers");
  const { data: me } = useApi<{ role: string }>("/api/me");
  const canEdit = me?.role === "manager";
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function changeRule(a: Agreement, rule: string) {
    try {
      await apiSend("PATCH", `/api/agreements/${a.id}`, { window_rule: rule });
      setMsg({ ok: true, text: `${a.code}: delivery window → ${WINDOW_LABEL[rule as WindowRule]} (ghi audit, áp dụng cho lần allocation tiếp theo).` });
      reload();
    } catch (err) {
      setMsg({ ok: false, text: (err as ApiClientError).message });
    }
  }

  return (
    <>
      <PageHeader title="Khách hàng & hợp đồng khách-SKU" subtitle="SCR-03 · Delivery window theo từng hợp đồng (R-04): 1/3 · 1/2 · chỉ hạn trên nhãn — tập quán thương mại, không phải luật. Dòng chưa chốt giữ business-review, không áp mặc định." />
      {msg && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="space-y-4">
          {data?.customers.map((c) => (
            <Card key={c.id} title={<><span className="font-mono text-xs text-slate-500">{c.code}</span> {c.name}</>}
              actions={<Link href={`/customers/${c.id}`} className="text-xs text-sky-700 hover:underline">Lịch sử giao ({c.deliveries}) →</Link>}>
              <p className="mb-2 text-xs text-slate-500">Giao gần nhất: {fmtDateTime(c.lastDeliveredAt)}</p>
              <TableShell>
                <thead><tr><th>Hợp đồng</th><th>SKU</th><th>Điều kiện giao</th><th>Delivery window</th><th>Hiệu lực</th></tr></thead>
                <tbody>
                  {c.agreements.map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.code}</td>
                      <td>{a.product.sku} <span className="text-xs text-slate-500">{a.product.name}</span> <Badge>{EXPIRY_SHORT[a.product.expiry_type]}</Badge></td>
                      <td className="text-xs">{a.delivery_term}</td>
                      <td>
                        <select value={a.window_rule ?? ""} disabled={!canEdit} onChange={(e) => changeRule(a, e.target.value)}
                          className={`${inputClass} w-44 py-1 ${a.window_rule ? "" : "border-amber-400 bg-amber-50"}`} aria-label={`Delivery window ${a.code}`}>
                          {!a.window_rule && <option value="">Chưa chốt (business-review)</option>}
                          {(Object.keys(WINDOW_LABEL) as WindowRule[]).map((r) => <option key={r} value={r}>{WINDOW_LABEL[r]}</option>)}
                        </select>
                      </td>
                      <td className="text-xs">{fmtDate(a.effective_from)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
