"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Empty, ErrorBox, Loading } from "@/components/async-state";
import { Badge, Card, Field, inputClass, LinkButton, PageHeader, TableShell } from "@/components/ui-primitives";
import { EXPIRY_SHORT, fmtDate, fmtDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Row {
  id: string; qty: number; expiry_date: string; delivered_at: string; order: { id: string; code: string } | null;
  lot: { lot_no: string }; product: { sku: string; name: string; expiry_type: string };
}

export default function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [sku, setSku] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams(Object.entries({ sku, from, to }).filter(([, v]) => v)).toString();
  const { data, error, loading } = useApi<{ customer: { name: string; code: string }; history: Row[] }>(`/api/customers/${id}${qs ? `?${qs}` : ""}`);

  // Highest expiry delivered per SKU = the 日付逆転 threshold for this customer
  const thresholds = new Map<string, string>();
  for (const h of data?.history ?? []) {
    if ((thresholds.get(h.product.sku) ?? "") < h.expiry_date) thresholds.set(h.product.sku, h.expiry_date);
  }

  return (
    <>
      <PageHeader title={data ? `Lịch sử giao — ${data.customer.name}` : "Lịch sử giao"}
        subtitle={<>DR-HIST-01 · Lịch sử giao bất biến — nền của kiểm tra 日付逆転 theo từng cặp khách-SKU {data && <Badge tone="blue">{data.customer.code}</Badge>}</>}
        actions={<LinkButton href="/customers" variant="secondary">← Khách hàng</LinkButton>} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="SKU"><input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="VD: CHI-002" className={inputClass} /></Field>
          <Field label="Từ ngày"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} /></Field>
          <Field label="Đến ngày"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></Field>
        </div>
      </Card>
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} /> : (
        <Card>
          {data?.history.length === 0 ? <Empty>Chưa có lịch sử giao phù hợp.</Empty> : (
            <TableShell>
              <thead><tr><th>Ngày giao</th><th>Đơn</th><th>SKU</th><th>Lô</th><th>Hạn dùng</th><th>SL</th></tr></thead>
              <tbody>
                {data?.history.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs">{fmtDateTime(h.delivered_at)}</td>
                    <td>{h.order ? <Link href={`/outbound/${h.order.id}`} className="text-sky-700 hover:underline">{h.order.code}</Link> : "—"}</td>
                    <td>{h.product.sku} <span className="text-xs text-slate-500">{h.product.name}</span></td>
                    <td className="font-mono text-xs">{h.lot.lot_no}</td>
                    <td>{fmtDate(h.expiry_date)} <Badge>{EXPIRY_SHORT[h.product.expiry_type]}</Badge>
                      {!from && !to && thresholds.get(h.product.sku) === h.expiry_date && <> <Badge tone="violet">mốc 日付逆転</Badge></>}</td>
                    <td className="tabular-nums">{h.qty}</td>
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
