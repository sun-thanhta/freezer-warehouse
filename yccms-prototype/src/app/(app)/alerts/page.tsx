"use client";

import Link from "next/link";
import { Empty, ErrorBox, Loading } from "@/components/async-state";
import { Badge, Card, PageHeader, TableShell } from "@/components/ui-primitives";
import { fmtDate, fmtDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Risk {
  order: { id: string; code: string; ship_date: string }; customer: { code: string; name: string };
  product: { sku: string; name: string }; qty: number; severity: "blocked" | "avoided"; shortfall: number; pending: boolean;
  lastDelivery: { expiry_date: string; lot_no: string } | null;
  reversalLots: { lot_no: string; expiry_date: string; qty_on_hand: number }[];
}
interface RequestRow {
  id: string; status: "pending" | "approved" | "rejected" | "cancelled"; reason: string; requested_email: string | null; decided_email: string | null;
  decision_note: string | null; created_at: string; order: { id: string; code: string; customer: { code: string; name: string } };
}
interface EventRow {
  id: string; rule: string; decision: "blocked" | "overridden"; reason: string | null; actor_email: string | null; approver_email: string | null;
  created_at: string; lot_expiry: string; reference_date: string; order: { id: string; code: string };
  customer: { code: string; name: string }; product: { sku: string }; lot: { lot_no: string };
}
const STATUS_TONE = { pending: "violet", approved: "green", rejected: "red", cancelled: "gray" } as const;
const STATUS_LABEL = { pending: "Chờ duyệt", approved: "Đã duyệt → giao", rejected: "Từ chối", cancelled: "Huỷ (đơn đã giao)" };

export default function DateReversalAlertsPage() {
  const { data, error, loading, reload } = useApi<{ risks: Risk[]; requests: RequestRow[]; events: EventRow[] }>("/api/alerts/date-reversal");
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Không có dữ liệu"} onRetry={reload} />;
  const blocked = data.risks.filter((r) => r.severity === "blocked");
  const avoided = data.risks.filter((r) => r.severity === "avoided");

  return (
    <>
      <PageHeader title="Cảnh báo 日付逆転 (đảo ngược ngày)"
        subtitle="SCR-13A / SCR-05 · Sắp giao cho khách một lô có hạn SỚM HƠN lô đã giao trước đó cho chính cặp khách-SKU ấy (BR-DATE-01). So theo lịch sử giao, không so với hôm nay, không mượn lịch sử khách khác." />
      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <b>Quy tắc (US-02):</b> CUS-003 đã nhận CHI-002 hạn X → mọi lô CHI-002 hạn sớm hơn X bị <b>CHẶN</b> khi giao cho CUS-003, dù còn xa hạn.
        CUS-004 chưa có lịch sử SKU này → không bị ảnh hưởng. Ngoại lệ: người lập đề nghị ≠ người duyệt (maker-checker).
      </div>

      <Card title={<>Đơn sắp giao bị CHẶN <Badge tone="red">{blocked.length}</Badge></>} className="mb-6">
        {blocked.length === 0 ? <Empty>Không có đơn nào bị chặn.</Empty> : <RiskTable risks={blocked} />}
      </Card>
      {avoided.length > 0 && (
        <Card title={<>Có lô 日付逆転 trong kho nhưng đã có lô hợp lệ thay thế <Badge tone="gray">{avoided.length}</Badge></>} className="mb-6">
          <RiskTable risks={avoided} />
        </Card>
      )}

      <Card title={<>Hàng chờ duyệt ngoại lệ (maker-checker) <Badge tone="violet">{data.requests.filter((r) => r.status === "pending").length}</Badge></>} className="mb-6">
        {data.requests.length === 0 ? <Empty>Chưa có đề nghị nào.</Empty> : (
          <TableShell>
            <thead><tr><th>Thời điểm</th><th>Đơn / khách</th><th>Người đề nghị</th><th>Lý do</th><th>Trạng thái</th><th>Người duyệt</th></tr></thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</td>
                  <td><Link href={`/outbound/${r.order.id}`} className="text-sky-700 hover:underline">{r.order.code}</Link><div className="text-xs text-slate-500">{r.order.customer.code} {r.order.customer.name}</div></td>
                  <td className="text-xs">{r.requested_email}</td>
                  <td className="text-xs">“{r.reason}”</td>
                  <td><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td className="text-xs">{r.decided_email ?? "—"}{r.decision_note && <div className="text-slate-500">“{r.decision_note}”</div>}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Card title="Nhật ký ngoại lệ bất biến (BR-DATE-01 / BR-EXP-02)">
        {data.events.length === 0 ? <Empty>Chưa có lượt chặn/duyệt nào.</Empty> : (
          <TableShell>
            <thead><tr><th>Thời điểm</th><th>Quy tắc</th><th>Đơn</th><th>Khách</th><th>SKU / lô</th><th>Hạn lô vs mốc</th><th>Quyết định</th><th>Người / lý do</th></tr></thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(e.created_at)}</td>
                  <td><Badge tone={e.rule === "BR-EXP-02" ? "red" : "amber"}>{e.rule === "BR-EXP-02" ? "消費期限" : "日付逆転"}</Badge></td>
                  <td><Link href={`/outbound/${e.order.id}`} className="text-sky-700 hover:underline">{e.order.code}</Link></td>
                  <td className="text-xs">{e.customer.code} {e.customer.name}</td>
                  <td>{e.product.sku} <span className="font-mono text-xs">{e.lot.lot_no}</span></td>
                  <td className="text-xs">{fmtDate(e.lot_expiry)} {e.rule === "BR-EXP-02" ? "≤ ngày giao" : "<"} {fmtDate(e.reference_date)}</td>
                  <td>{e.decision === "blocked" ? <Badge tone="red">Bị chặn</Badge> : <Badge tone="violet">Đã duyệt ngoại lệ</Badge>}</td>
                  <td className="text-xs">{e.actor_email}{e.reason && <div className="text-slate-500">“{e.reason}”</div>}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </>
  );
}

function RiskTable({ risks }: { risks: Risk[] }) {
  return (
    <TableShell>
      <thead><tr><th>Đơn / ngày giao</th><th>Khách</th><th>SKU / SL</th><th>Mốc đã giao cho khách</th><th>Lô hạn sớm hơn trong kho</th><th></th></tr></thead>
      <tbody>
        {risks.map((r, i) => (
          <tr key={`${r.order.id}-${r.product.sku}-${i}`}>
            <td><div className="font-medium">{r.order.code}</div><div className="text-xs text-slate-500">{fmtDate(r.order.ship_date)}</div></td>
            <td className="text-xs">{r.customer.code} {r.customer.name}</td>
            <td>{r.product.sku} · {r.qty}{r.shortfall > 0 && <div className="text-xs text-red-600">thiếu {r.shortfall} lô hợp lệ</div>}
              {r.pending && <div><Badge tone="violet">Đang chờ duyệt</Badge></div>}</td>
            <td className="text-xs">{r.lastDelivery ? <>lô <span className="font-mono">{r.lastDelivery.lot_no}</span><br />hạn <b>{fmtDate(r.lastDelivery.expiry_date)}</b></> : "—"}</td>
            <td className="text-xs">{r.reversalLots.map((l) => <div key={l.lot_no}><span className="font-mono">{l.lot_no}</span> hạn {fmtDate(l.expiry_date)} (tồn {l.qty_on_hand})</div>)}</td>
            <td><Link href={`/outbound/${r.order.id}`} className="text-sm font-medium text-sky-700 hover:underline">Xử lý →</Link></td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
