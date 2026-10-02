"use client";

import Link from "next/link";
import { Empty, ErrorBox, Loading } from "@/components/async-state";
import { Badge, Card, LinkButton, PageHeader, TableShell } from "@/components/ui-primitives";
import { fmtDate } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Receipt {
  id: string; code: string; arrival_date: string; note: string | null;
  supplier: { code: string; name: string }; lines: { qty: number; temp_ok: boolean; result: string }[];
}

export default function InboundListPage() {
  const { data, error, loading, reload } = useApi<{ receipts: Receipt[] }>("/api/inbound");
  return (
    <>
      <PageHeader title="Phiếu nhập kho" subtitle="SCR-07 · Danh sách phiếu nhập & kết quả kiểm hàng (受入 / 拒否 / 保留)"
        actions={<LinkButton href="/inbound/new">+ Tạo phiếu nhập</LinkButton>} />
      {loading && !data ? <Loading /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <Card>
          {data?.receipts.length === 0 ? <Empty>Chưa có phiếu nhập.</Empty> : (
            <TableShell>
              <thead><tr><th>Mã phiếu</th><th>Ngày nhận</th><th>Nhà cung cấp</th><th>Dòng</th><th>Số lượng</th><th>Kết quả kiểm</th></tr></thead>
              <tbody>
                {data?.receipts.map((r) => {
                  const fails = r.lines.filter((l) => !l.temp_ok).length;
                  const rejected = r.lines.filter((l) => l.result === "rejected").length;
                  const held = r.lines.filter((l) => l.result === "hold").length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td><Link href={`/inbound/${r.id}`} className="font-medium text-sky-700 hover:underline">{r.code}</Link></td>
                      <td>{fmtDate(r.arrival_date)}</td>
                      <td>{r.supplier.name}</td>
                      <td>{r.lines.length}</td>
                      <td className="tabular-nums">{r.lines.reduce((s, l) => s + l.qty, 0)}</td>
                      <td className="space-x-1">
                        {fails === 0 ? <Badge tone="green">Nhiệt độ đạt</Badge> : <Badge tone="red">{fails} dòng lệch nhiệt</Badge>}
                        {held > 0 && <Badge tone="amber">{held} 保留 → 隔離</Badge>}
                        {rejected > 0 && <Badge tone="red">{rejected} từ chối</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
        </Card>
      )}
    </>
  );
}
