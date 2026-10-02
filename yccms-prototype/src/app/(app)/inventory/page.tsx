"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Empty, ErrorBox, Loading } from "@/components/async-state";
import type { MasterData } from "@/components/inbound-line-editor";
import { QuarantineActions } from "@/components/quarantine-actions";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui-primitives";
import { EXPIRY_SHORT, fmtDate, LANE_LABEL } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Lot {
  id: string; lot_no: string; expiry_date: string; qty_received: number; qty_on_hand: number; trace_code: string | null; status: string;
  daysLeft: number; expiry: "ok" | "near" | "expired"; location: { code: string; zone_id: number; is_quarantine: boolean } | null; supplier: { name: string };
  product: { sku: string; name: string; unit: string; expiry_type: string; trace_lane: string; near_expiry_days: number; zone_id: number; zone: { name: string } };
}
const VIEWS = [["all", "Toàn bộ tồn"], ["near", "Cận hạn & quá hạn"], ["quarantine", "隔離"]] as const;
const ZONES = [{ id: 0, label: "Tất cả dải" }, { id: 1, label: "常温" }, { id: 2, label: "冷蔵" }, { id: 3, label: "冷凍" }];

function InventoryView() {
  const router = useRouter();
  const params = useSearchParams();
  const view = VIEWS.some(([v]) => v === params.get("view")) ? params.get("view")! : "all";
  const zone = Number(params.get("zone") ?? 0);
  const { data, error, loading, reload } = useApi<{ today: string; lots: Lot[] }>(`/api/inventory?view=${view}&zone=${zone}`);
  const { data: me } = useApi<{ role: string }>("/api/me");
  const { data: master } = useApi<MasterData>(view === "quarantine" ? "/api/master" : null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const go = (v: string, z: number) => router.replace(`/inventory?view=${v}&zone=${z}`);
  const isManager = me?.role === "manager";

  return (
    <>
      <PageHeader title={view === "quarantine" ? "隔離 / release / scrap" : view === "near" ? "Cảnh báo cận hạn" : "Tồn kho đa tiêu chí"}
        subtitle="SCR-08 / SCR-10 · Tồn theo SKU / lô / vị trí / dải nhiệt. Ngưỡng cận hạn riêng từng SKU; lô 隔離 bị khóa, không vào allocation." />
      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map(([v, label]) => (
          <button key={v} onClick={() => go(v, zone)} className={`rounded-lg px-3 py-1.5 text-sm ${view === v ? "bg-sky-700 text-white" : "border border-slate-300 bg-white"}`}>{label}</button>
        ))}
        <span className="mx-1 border-l border-slate-300" />
        {ZONES.map((z) => (
          <button key={z.id} onClick={() => go(view, z.id)} className={`rounded-lg px-3 py-1.5 text-sm ${zone === z.id ? "bg-slate-800 text-white" : "border border-slate-300 bg-white"}`}>{z.label}</button>
        ))}
      </div>
      {msg && <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <Card>
          {data?.lots.length === 0 ? <Empty>Không có lô phù hợp.</Empty> : (
            <TableShell>
              <thead><tr><th>SKU</th><th>Lô / truy xuất</th><th>Dải / vị trí</th><th>Loại hạn</th><th>Hạn dùng</th><th>Còn</th><th>Tồn / nhập</th><th>{view === "quarantine" && isManager ? "Xử lý (QA)" : "NCC"}</th></tr></thead>
              <tbody>
                {data?.lots.map((l) => (
                  <tr key={l.id} className={l.status === "quarantine" ? "bg-violet-50/60" : l.expiry === "expired" ? "bg-red-50/60" : l.expiry === "near" ? "bg-amber-50/60" : ""}>
                    <td><div className="font-medium">{l.product.sku}</div><div className="text-xs text-slate-500">{l.product.name}</div></td>
                    <td className="font-mono text-xs">{l.lot_no}{l.trace_code && <div className="text-violet-700">{l.trace_code}</div>}
                      {l.product.trace_lane !== "internal_lot" && <div className="font-sans text-slate-500">{LANE_LABEL[l.product.trace_lane]}</div>}</td>
                    <td className="text-xs">{l.product.zone.name}<br />{l.location?.code ?? "—"}
                      {l.status === "quarantine" && <> <Badge tone="violet">隔離</Badge></>}
                      {l.location && l.location.zone_id !== l.product.zone_id && <> <Badge tone="red">sai dải</Badge></>}</td>
                    <td><Badge tone={l.product.expiry_type === "use_by" ? "red" : "gray"}>{EXPIRY_SHORT[l.product.expiry_type]}</Badge></td>
                    <td>{fmtDate(l.expiry_date)}</td>
                    <td>{l.expiry === "expired" ? <Badge tone="red">Quá hạn {-l.daysLeft} ngày</Badge>
                      : l.expiry === "near" ? <Badge tone="amber">{l.daysLeft} ngày (ngưỡng {l.product.near_expiry_days})</Badge>
                      : <span className="text-sm text-slate-600">{l.daysLeft} ngày</span>}</td>
                    <td className="tabular-nums">{l.qty_on_hand} / {l.qty_received} {l.product.unit}</td>
                    <td className="text-xs">{view === "quarantine" && isManager && l.status === "quarantine"
                      ? <QuarantineActions lotId={l.id} lotNo={l.lot_no} onDone={(m) => { setMsg(m); if (m.ok) reload(); }}
                          locations={(master?.locations ?? []).filter((x) => x.zone_id === l.product.zone_id && !x.is_quarantine)} />
                      : l.supplier.name}</td>
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

export default function InventoryPage() {
  return <Suspense fallback={<Loading />}><InventoryView /></Suspense>;
}
