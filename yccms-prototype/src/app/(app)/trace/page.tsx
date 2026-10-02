"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Empty, ErrorBox } from "@/components/async-state";
import { Badge, Button, Card, Field, inputClass, PageHeader, TableShell } from "@/components/ui-primitives";
import { fmtDate, fmtDateTime, fmtTemp, LANE_LABEL } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Delivery {
  id: string; qty: number; expiry_date: string; delivered_at: string; order: { id: string; code: string } | null;
  customer: { code: string; name: string };
  lot: { lot_no: string; trace_code: string | null; supplier: { name: string }; inbound: { temp_c: number; receipt: { id: string; code: string; arrival_date: string } } | null };
  product: { sku: string; name: string; trace_lane: string };
}
interface LotInfo {
  lot_no: string; mfg_date: string; expiry_date: string; qty_received: number; qty_on_hand: number; trace_code: string | null;
  supplier: { name: string }; product: { sku: string; name: string; trace_lane: string };
  inbound: { temp_c: number; temp_ok: boolean; receipt: { id: string; code: string; arrival_date: string } } | null;
}

export default function TracePage() {
  const { data: customers } = useApi<{ customers: { id: number; code: string; name: string }[] }>("/api/customers");
  const [lotInput, setLotInput] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const { data, error, loading } = useApi<{ mode: "forward" | "backward"; lot?: LotInfo; deliveries: Delivery[] }>(query);

  const searchLot = (e: FormEvent) => { e.preventDefault(); if (lotInput.trim()) setQuery(`/api/trace?lot=${encodeURIComponent(lotInput.trim())}`); };

  return (
    <>
      <PageHeader title="Truy xuất nguồn gốc" subtitle="SCR-27 · Truy xuôi (lô → khách đã nhận) và truy ngược (khách → lô → nhà cung cấp → phiếu nhập). 3 lane: gạo (産地・取引) và bò (mã 10 số) là pháp định; còn lại nội bộ." />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card title="Truy xuôi — từ lô">
          <form onSubmit={searchLot} className="flex items-end gap-2">
            <div className="flex-1"><Field label="Số lô"><input value={lotInput} onChange={(e) => setLotInput(e.target.value)} placeholder="VD: LOT-CHI001-A" className={inputClass} /></Field></div>
            <Button type="submit">Truy xuôi</Button>
          </form>
        </Card>
        <Card title="Truy ngược — từ khách hàng">
          <Field label="Khách hàng">
            <select onChange={(e) => e.target.value && setQuery(`/api/trace?customer=${e.target.value}`)} className={inputClass} defaultValue="">
              <option value="">— Chọn khách —</option>
              {customers?.customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </Field>
        </Card>
      </div>

      {loading && <p className="text-sm text-slate-500">Đang truy vết…</p>}
      {error && <ErrorBox error={error} />}
      {data?.mode === "forward" && data.lot && (
        <Card title={`Lô ${data.lot.lot_no} — ${data.lot.product.sku} ${data.lot.product.name}`} className="mb-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Nhà cung cấp</dt><dd>{data.lot.supplier.name}</dd></div>
            <div><dt className="text-xs text-slate-500">Phiếu nhập</dt><dd>{data.lot.inbound ? <Link href={`/inbound/${data.lot.inbound.receipt.id}`} className="text-sky-700 hover:underline">{data.lot.inbound.receipt.code}</Link> : "—"} · {fmtTemp(data.lot.inbound?.temp_c)}</dd></div>
            <div><dt className="text-xs text-slate-500">NSX → hạn</dt><dd>{fmtDate(data.lot.mfg_date)} → {fmtDate(data.lot.expiry_date)}</dd></div>
            <div><dt className="text-xs text-slate-500">Mã truy xuất</dt><dd className="font-mono">{data.lot.trace_code ?? "—"} {data.lot.product.trace_lane !== "internal_lot" && <Badge tone="violet">{LANE_LABEL[data.lot.product.trace_lane]}</Badge>}</dd></div>
            <div><dt className="text-xs text-slate-500">Đã nhập / còn tồn</dt><dd>{data.lot.qty_received} / {data.lot.qty_on_hand}</dd></div>
          </dl>
        </Card>
      )}
      {data && (
        <Card title={data.mode === "forward" ? "Các khách đã nhận lô này" : "Các lô khách đã nhận"}>
          {data.deliveries.length === 0 ? <Empty>Chưa có giao hàng liên quan.</Empty> : (
            <TableShell>
              <thead><tr><th>Ngày giao</th><th>Khách</th><th>Đơn</th><th>SKU</th><th>Lô / mã truy xuất</th><th>Nhà cung cấp ← phiếu nhập</th><th>SL</th></tr></thead>
              <tbody>
                {data.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="text-xs">{fmtDateTime(d.delivered_at)}</td>
                    <td>{d.customer.name}</td>
                    <td>{d.order ? <Link href={`/outbound/${d.order.id}`} className="text-sky-700 hover:underline">{d.order.code}</Link> : "—"}</td>
                    <td>{d.product.sku}{d.product.trace_lane !== "internal_lot" && <> <Badge tone="violet">{d.product.trace_lane === "beef" ? "牛" : "米"}</Badge></>}</td>
                    <td className="font-mono text-xs">{d.lot.lot_no}<div className="text-violet-700">{d.lot.trace_code}</div></td>
                    <td className="text-xs">{d.lot.supplier.name}<div className="text-slate-500">{d.lot.inbound?.receipt.code} ({fmtDate(d.lot.inbound?.receipt.arrival_date)})</div></td>
                    <td className="tabular-nums">{d.qty}</td>
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
