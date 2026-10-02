"use client";

import Link from "next/link";
import { ErrorBox, Loading } from "@/components/async-state";
import { Card, LinkButton, PageHeader, StatTile } from "@/components/ui-primitives";
import { fmtDate, fmtDateTime } from "@/lib/client/format";
import { useApi } from "@/lib/client/use-api";

interface Dashboard {
  today: string; inboundToday: number; openOrders: number; reversalBlocked: number; pendingApprovals: number;
  excludedLots: number; quarantineLots: number; nearExpiryLots: number; useByExpiredLots: number; reviewAgreements: number;
  tempFailures7d: number; blockedEvents7d: number; overrides7d: number;
  recentAudit: { id: number; action: string; actor_email: string; created_at: string; entity_id: string | null }[];
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>("/api/dashboard");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <PageHeader title="Tổng quan vận hành" subtitle={`Ngày làm việc ${fmtDate(data.today)} (giờ Nhật)`}
        actions={<><LinkButton href="/inbound/new">+ Phiếu nhập</LinkButton><LinkButton href="/outbound" variant="secondary">Xuất kho</LinkButton></>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Đơn xuất đang mở" value={data.openOrders} hint={`${data.excludedLots} lô bị loại theo chuỗi FR-OUT-02`} tone="blue" href="/outbound" />
        <StatTile label="Dòng bị chặn 日付逆転" value={data.reversalBlocked} hint="Không còn lô hợp lệ" tone="red" href="/alerts" />
        <StatTile label="Chờ duyệt ngoại lệ" value={data.pendingApprovals} hint="Maker-checker" tone="violet" href="/alerts" />
        <StatTile label="Hợp đồng chưa chốt window" value={data.reviewAgreements} hint="Business-review, không áp mặc định" tone="amber" href="/customers" />
        <StatTile label="Lô đang 隔離" value={data.quarantineLots} hint="Khóa tồn, chờ QA" tone="violet" href="/inventory?view=quarantine" />
        <StatTile label="Lô 消費期限 đã đến" value={data.useByExpiredLots} hint="Hard stop — không giao" tone="red" href="/inventory?view=near" />
        <StatTile label="Lô cận hạn" value={data.nearExpiryLots} hint="Theo ngưỡng riêng từng SKU" tone="amber" href="/inventory?view=near" />
        <StatTile label="Nhiệt lệch khi nhận (7 ngày)" value={data.tempFailures7d} hint={`${data.inboundToday} phiếu nhập hôm nay`} tone="gray" href="/inbound" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Nhật ký ngoại lệ (7 ngày)">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div><div className="text-3xl font-semibold text-red-600">{data.blockedEvents7d}</div><div className="text-xs text-slate-500">Lượt bị chặn</div></div>
            <div><div className="text-3xl font-semibold text-violet-600">{data.overrides7d}</div><div className="text-xs text-slate-500">Ngoại lệ đã duyệt (maker-checker)</div></div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            日付逆転: so hạn lô định giao với hạn <b>đã giao trước đó cho chính cặp khách-SKU</b> — không so với hôm nay. 消費期限 đến hạn là hard stop.
          </p>
        </Card>
        <Card title="Thao tác gần đây" actions={<Link href="/audit" className="text-xs text-sky-700 hover:underline">Xem audit log →</Link>}>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.recentAudit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 py-2">
                <span><code className="text-xs text-sky-800">{a.action}</code> <span className="text-slate-500">· {a.actor_email}</span></span>
                <span className="whitespace-nowrap text-xs text-slate-400">{fmtDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
