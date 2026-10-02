"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Loading } from "@/components/async-state";
import { OutboundLinePicker, type LinePicks } from "@/components/outbound-line-picker";
import { OverrideDecisionPanel } from "@/components/override-decision-panel";
import { Badge, Button, Card, Field, inputClass, LinkButton, PageHeader } from "@/components/ui-primitives";
import { fmtDate, fmtDateTime, fmtRange, fmtTemp } from "@/lib/client/format";
import { ApiClientError, apiSend, useApi } from "@/lib/client/use-api";
import type { PickPlan } from "@/lib/services/pick-plan-types";

interface Delivered { qty: number; expiry_date: string; delivered_at: string; lot: { lot_no: string }; product: { sku: string; name: string } }
interface ShipResult { requested: boolean; warnings: string[] }

export default function OutboundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading, reload } = useApi<{ plan: PickPlan; delivered: Delivered[] }>(`/api/outbound/${id}`);
  const { data: me } = useApi<{ email: string; role: string }>("/api/me");
  const [edited, setEdited] = useState<{ source: unknown; picks: Record<string, LinePicks> } | null>(null);
  const [temp, setTemp] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ error?: ApiClientError; ok?: ShipResult } | null>(null);
  const [busy, setBusy] = useState(false);

  // Picks start from the FEFO suggestion and reset whenever the plan (re)loads
  const picks: Record<string, LinePicks> = edited && edited.source === data ? edited.picks
    : Object.fromEntries((data?.plan.lines ?? []).map((l) => [l.id, Object.fromEntries(l.suggestion.allocations.map((a) => [a.lot_id, String(a.qty)]))]));
  const setPicks = (next: Record<string, LinePicks>) => setEdited({ source: data, picks: next });

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error ?? "Không có dữ liệu"} onRetry={reload} />;
  const { plan } = data;
  const open = plan.order.status === "open";
  const pickedReversal = plan.lines.some((l) => l.lots.some((lot) => lot.exclusions.includes("date_reversal") && Number(picks[l.id]?.[lot.id]) > 0));

  async function confirm() {
    setBusy(true);
    setResult(null);
    try {
      const allocations = Object.entries(picks).flatMap(([lineId, lots]) =>
        Object.entries(lots).filter(([, q]) => Number(q) > 0).map(([lotId, q]) => ({ order_line_id: lineId, lot_id: lotId, qty: Number(q) })));
      const res = await apiSend<ShipResult>("POST", `/api/outbound/${id}/ship`, {
        allocations, ship_temp_c: temp === "" ? null : Number(temp), override_reason: pickedReversal ? reason : "",
      });
      setResult({ ok: res });
      reload();
    } catch (err) {
      setResult({ error: err as ApiClientError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={`Đơn xuất ${plan.order.code}`} subtitle={<>SCR-13 · {plan.customer.code} {plan.customer.name} · giao {fmtDate(plan.order.ship_date)}</>}
        actions={<LinkButton href="/outbound" variant="secondary">← Danh sách</LinkButton>} />

      {result?.ok && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <b>{result.ok.requested ? "Đã gửi đề nghị ngoại lệ — chờ một quản lý khác duyệt." : "Đã xác nhận giao."}</b>
          {!result.ok.requested && " Lịch sử giao của khách đã cập nhật, tồn kho đã trừ."}
          {result.ok.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{result.ok.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}
      {open && plan.pendingOverride && <OverrideDecisionPanel request={plan.pendingOverride} me={me} onDone={reload} />}

      {open ? (
        <div className="space-y-4">
          {plan.lines.map((line) => (
            <OutboundLinePicker key={line.id} line={line} picks={picks[line.id] ?? {}} readOnly={Boolean(plan.pendingOverride)}
              onChange={(p) => setPicks({ ...picks, [line.id]: p })} />
          ))}
          {!plan.pendingOverride && (
            <Card title="Kiểm trước xuất & xác nhận giao (SCR-15)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nhiệt độ hàng khi xuất (°C)" hint={`Đo ở dải lạnh nhất của đơn: ${fmtRange(plan.shipTempRange.min, plan.shipTempRange.max)}`}>
                  <input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} className={inputClass} />
                </Field>
                {pickedReversal && (
                  <Field label="Lý do đề nghị ngoại lệ 日付逆転" hint="Có lý do → tạo đề nghị cho quản lý khác duyệt; để trống → hệ thống chặn và ghi nhật ký">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="VD: khách đồng ý bằng văn bản" />
                  </Field>
                )}
              </div>
              {result?.error && <div className="mt-4"><ErrorBox error={result.error} /></div>}
              <div className="mt-4 flex justify-end">
                <Button onClick={confirm} disabled={busy} variant={pickedReversal ? "danger" : "primary"}>
                  {busy ? "Đang kiểm tra…" : pickedReversal ? (reason.trim() ? "Gửi đề nghị ngoại lệ" : "Xác nhận giao (có vi phạm 日付逆転)") : "Kiểm tra & xác nhận giao"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card title={<>Đã giao <Badge tone="green">shipped</Badge></>}>
          <p className="mb-3 text-sm text-slate-600">Giao lúc {fmtDateTime(plan.order.shipped_at)} · nhiệt khi xuất {fmtTemp(plan.order.ship_temp_c)}</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.delivered.map((d, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{d.product.sku} · {d.product.name}</span>
                <span className="text-slate-600">lô <span className="font-mono">{d.lot.lot_no}</span> · hạn {fmtDate(d.expiry_date)} · SL {d.qty}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
