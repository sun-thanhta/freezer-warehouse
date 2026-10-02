"use client";

import { useParams } from "next/navigation";
import { ErrorBox, Loading } from "@/components/async-state";
import { Badge, Card, LinkButton, PageHeader, TableShell } from "@/components/ui-primitives";
import { EXPIRY_SHORT, fmtDate, fmtDateTime, fmtRange, fmtTemp, LANE_LABEL, RESULT_LABEL } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Line {
  id: string; lot_no: string; mfg_date: string; expiry_date: string; qty: number; temp_c: number; temp_ok: boolean;
  temp_note: string | null; trace_code: string | null; result: string; location: { code: string } | null;
  product: { sku: string; name: string; unit: string; expiry_type: string; trace_lane: string;
    zone: { name: string; min_c: number | null; max_c: number | null } };
}
interface Receipt { id: string; code: string; arrival_date: string; note: string | null; created_at: string; supplier: { code: string; name: string }; lines: Line[] }

export default function InboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<{ receipt: Receipt }>(`/api/inbound/${id}`);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Không có dữ liệu"} />;
  const r = data.receipt;

  return (
    <>
      <PageHeader title={`Phiếu nhập ${r.code}`} subtitle={`${r.supplier.name} · nhận ${fmtDate(r.arrival_date)} · tạo ${fmtDateTime(r.created_at)}`}
        actions={<LinkButton href="/inbound" variant="secondary">← Danh sách</LinkButton>} />
      {r.note && <p className="mb-4 text-sm text-slate-600">Ghi chú: {r.note}</p>}
      <Card title="Kết quả kiểm từng dòng">
        <TableShell>
          <thead><tr><th>SKU</th><th>Lô</th><th>NSX → Hạn</th><th>SL</th><th>Nhiệt đo</th><th>Ngưỡng</th><th>Vị trí</th><th>Truy xuất</th><th>Kết quả</th></tr></thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.id}>
                <td><div className="font-medium">{l.product.sku}</div><div className="text-xs text-slate-500">{l.product.name}</div></td>
                <td className="font-mono text-xs">{l.lot_no}</td>
                <td className="text-xs">{fmtDate(l.mfg_date)} → {fmtDate(l.expiry_date)} <Badge>{EXPIRY_SHORT[l.product.expiry_type]}</Badge></td>
                <td className="tabular-nums">{l.qty}</td>
                <td><span className={l.temp_ok ? "text-emerald-700" : "font-semibold text-red-600"}>{fmtTemp(l.temp_c)}</span>
                  {l.temp_note && <div className="text-xs text-red-600">{l.temp_note}</div>}</td>
                <td className="text-xs">{l.product.zone.name}<br />{fmtRange(l.product.zone.min_c, l.product.zone.max_c)}</td>
                <td>{l.location?.code ?? "—"}</td>
                <td className="font-mono text-xs">{l.trace_code ?? "—"}{l.product.trace_lane !== "internal_lot" && <div className="font-sans text-violet-700">{LANE_LABEL[l.product.trace_lane]}</div>}</td>
                <td><Badge tone={l.result === "accepted" ? "green" : l.result === "hold" ? "amber" : "red"}>{RESULT_LABEL[l.result]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Card>
    </>
  );
}
