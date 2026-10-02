"use client";

import { Badge, inputClass, type Tone } from "@/components/ui-primitives";
import { EXCLUSION_LABEL, EXPIRY_SHORT, fmtDate, fmtDateTime } from "@/lib/client/format";
import { WINDOW_LABEL } from "@/lib/rules/delivery-window-rules";
import type { PlanLine } from "@/lib/services/pick-plan-types";

export type LinePicks = Record<string, string>; // lot_id -> qty (string for input)

const STATUS = {
  ok: <Badge tone="green">Đủ lô hợp lệ</Badge>,
  date_reversal: <Badge tone="red">Chặn 日付逆転</Badge>,
  insufficient: <Badge tone="amber">Thiếu lô hợp lệ</Badge>,
};
const EXCLUSION_TONE: Record<string, Tone> = { use_by_expired: "red", zone_mismatch: "red", quarantine: "red", window_violation: "amber", date_reversal: "red" };
const HARD = new Set(["use_by_expired", "zone_mismatch", "quarantine"]);

export function OutboundLinePicker({ line, picks, onChange, readOnly }: {
  line: PlanLine; picks: LinePicks; onChange: (p: LinePicks) => void; readOnly: boolean;
}) {
  const picked = Object.values(picks).reduce((s, v) => s + (Number(v) || 0), 0);
  const suggested = new Set(line.suggestion.allocations.map((a) => a.lot_id));
  const rule = line.agreement?.window_rule;

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${line.status === "date_reversal" ? "border-red-300" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div>
          <div className="font-semibold">{line.product.sku} · {line.product.name}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <Badge tone="blue">{line.product.zone.name}</Badge>
            <Badge tone={line.product.expiry_type === "use_by" ? "red" : "gray"}>{EXPIRY_SHORT[line.product.expiry_type]}期限</Badge>
            {line.agreement
              ? <Badge tone={rule ? "gray" : "amber"}>{line.agreement.code} · {line.agreement.delivery_term} · {rule ? WINDOW_LABEL[rule] : "chưa chốt → business-review"}</Badge>
              : <Badge tone="red">Không có hợp đồng khách-SKU</Badge>}
            {!readOnly && STATUS[line.status]}
          </div>
        </div>
        <div className="text-right text-sm">
          <div>Cần giao: <b className="tabular-nums">{line.qty}</b> {line.product.unit}</div>
          {!readOnly && <div className={picked === line.qty ? "text-emerald-700" : "text-amber-700"}>Đã chọn: <b className="tabular-nums">{picked}</b></div>}
        </div>
      </div>

      <div className="bg-slate-50 px-5 py-2 text-xs text-slate-600">
        Mốc 日付逆転 của cặp khách-SKU:{" "}
        {line.lastDelivery
          ? <>đã nhận lô <b className="font-mono">{line.lastDelivery.lot_no}</b> hạn <b>{fmtDate(line.lastDelivery.expiry_date)}</b> ({fmtDateTime(line.lastDelivery.delivered_at)}) → chỉ được giao lô hạn ≥ ngày này.</>
          : <>khách chưa từng nhận SKU này → không có ràng buộc (không mượn lịch sử khách khác).</>}
      </div>

      {line.status === "date_reversal" && !readOnly && (
        <div role="alert" className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <b>⚠ Cảnh báo 日付逆転:</b> không đủ lô hợp lệ — thiếu {line.suggestion.shortfall}. Còn {line.reversalOnlyQty} đơn vị chỉ vướng
          日付逆転 (hạn <b>sớm hơn</b> lô khách này đã nhận). Hệ thống CHẶN; muốn giao phải gửi đề nghị ngoại lệ có lý do và
          một quản lý <b>khác người đề nghị</b> duyệt (maker-checker).
        </div>
      )}

      <div className="overflow-x-auto px-5 py-3">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr><th className="py-1">Lô (FEFO → FIFO)</th><th>Hạn dùng</th><th>Tồn</th><th>Vị trí</th><th>Chuỗi loại trừ FR-OUT-02</th>{!readOnly && <th className="w-24">Lấy</th>}</tr>
          </thead>
          <tbody>
            {line.lots.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-400">Không còn tồn kho</td></tr>}
            {line.lots.map((lot) => (
              <tr key={lot.id} className={`border-t border-slate-100 ${lot.exclusions.length ? "bg-red-50/40" : ""}`}>
                <td className="py-2 font-mono text-xs">{lot.lot_no}</td>
                <td>{fmtDate(lot.expiry_date)}</td>
                <td className="tabular-nums">{lot.qty_on_hand}</td>
                <td className="text-xs">{lot.location ?? "—"}</td>
                <td className="space-x-1 space-y-1">
                  {suggested.has(lot.id) && <Badge tone="blue">Đề xuất FEFO</Badge>}
                  {lot.exclusions.map((code) => (
                    <Badge key={code} tone={EXCLUSION_TONE[code]}>
                      {EXCLUSION_LABEL[code]}
                      {code === "date_reversal" && ` (< ${fmtDate(line.lastDelivery?.expiry_date)})`}
                      {code === "window_violation" && ` ${fmtDate(lot.window.deadline)} — chỉ cảnh báo`}
                    </Badge>
                  ))}
                  {lot.exclusions.length === 0 && lot.window.status === "ok" && rule !== "LABEL_DATE_ONLY" && (
                    <span className="text-xs text-slate-400">納品期限 {fmtDate(lot.window.deadline)}</span>
                  )}
                </td>
                {!readOnly && (
                  <td>
                    <input type="number" min={0} max={lot.qty_on_hand} disabled={lot.exclusions.some((c) => HARD.has(c))} value={picks[lot.id] ?? ""}
                      onChange={(e) => onChange({ ...picks, [lot.id]: e.target.value })} className={`${inputClass} py-1`} aria-label={`Số lượng lấy từ lô ${lot.lot_no}`} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
