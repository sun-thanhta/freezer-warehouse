"use client";

import { Badge, Field, inputClass } from "@/components/ui-primitives";
import { EXPIRY_SHORT, LANE_LABEL } from "@/lib/client/format";
import { formatTempRange, isTempWithinRange } from "@/lib/rules/temperature-rules";

export interface MasterProduct { id: number; sku: string; name: string; unit: string; zone_id: number; expiry_type: string; trace_lane: string }
export interface MasterData {
  suppliers: { id: number; code: string; name: string }[];
  products: MasterProduct[];
  locations: { id: number; code: string; zone_id: number; is_quarantine: boolean }[];
  zones: { id: number; name: string; min_c: number | null; max_c: number | null }[];
}
export interface LineDraft {
  product_id: string; lot_no: string; mfg_date: string; expiry_date: string; qty: string;
  temp_c: string; temp_note: string; trace_code: string; location_id: string; result: "accepted" | "rejected" | "hold";
}

export const emptyLine = (): LineDraft => ({
  product_id: "", lot_no: "", mfg_date: "", expiry_date: "", qty: "", temp_c: "", temp_note: "", trace_code: "", location_id: "", result: "accepted",
});

export function InboundLineEditor({ index, line, master, onChange, onRemove }: {
  index: number; line: LineDraft; master: MasterData; onChange: (l: LineDraft) => void; onRemove?: () => void;
}) {
  const product = master.products.find((p) => String(p.id) === line.product_id);
  const zone = product ? master.zones.find((z) => z.id === product.zone_id) : undefined;
  const range = zone ? { min: zone.min_c, max: zone.max_c } : null;
  const hasTemp = line.temp_c.trim() !== "" && !Number.isNaN(Number(line.temp_c));
  const tempOk = range && hasTemp ? isTempWithinRange(Number(line.temp_c), range) : null;
  const hasQuarantine = master.locations.some((l) => l.zone_id === product?.zone_id && l.is_quarantine);
  const set = (patch: Partial<LineDraft>) => onChange({ ...line, ...patch });
  const locations = master.locations.filter((l) => l.zone_id === product?.zone_id && l.is_quarantine === (line.result === "hold"));

  return (
    <div className={`rounded-xl border p-4 ${tempOk === false ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-white"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
          Dòng {index + 1}
          {zone && <Badge tone="blue">{zone.name}</Badge>}
          {product && <Badge tone={product.expiry_type === "use_by" ? "red" : "gray"}>{EXPIRY_SHORT[product.expiry_type]}期限</Badge>}
          {product && product.trace_lane !== "internal_lot" && <Badge tone="violet">Truy xuất pháp định: {LANE_LABEL[product.trace_lane]}</Badge>}
        </div>
        {onRemove && <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">Xóa dòng</button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Sản phẩm (SKU)">
          <select required value={line.product_id} onChange={(e) => set({ product_id: e.target.value, location_id: "", trace_code: "" })} className={inputClass}>
            <option value="">— Chọn —</option>
            {master.products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
          </select>
        </Field>
        <Field label="Số lô (lot)"><input required value={line.lot_no} onChange={(e) => set({ lot_no: e.target.value })} className={inputClass} /></Field>
        <Field label="Ngày sản xuất"><input type="date" required value={line.mfg_date} onChange={(e) => set({ mfg_date: e.target.value })} className={inputClass} /></Field>
        <Field label={`Hạn dùng ${product ? `(${EXPIRY_SHORT[product.expiry_type]}期限)` : ""}`}>
          <input type="date" required value={line.expiry_date} onChange={(e) => set({ expiry_date: e.target.value })} className={inputClass} />
        </Field>
        <Field label={`Số lượng${product ? ` (${product.unit})` : ""}`}><input type="number" min={1} required value={line.qty} onChange={(e) => set({ qty: e.target.value })} className={inputClass} /></Field>
        <Field label="Nhiệt độ đo khi nhận (°C)" hint={range ? `Ngưỡng Yuki: ${formatTempRange(range)}` : "Chọn SKU để thấy ngưỡng"}>
          <input type="number" step="0.1" required value={line.temp_c}
            onChange={(e) => {
              const v = e.target.value;
              const ok = range && v !== "" ? isTempWithinRange(Number(v), range) : true;
              set({ temp_c: v, result: ok ? "accepted" : hasQuarantine ? "hold" : "rejected", location_id: "" });
            }}
            className={`${inputClass} ${tempOk === false ? "border-red-400" : tempOk ? "border-emerald-400" : ""}`} />
        </Field>
        <Field label={line.result === "hold" ? "Vị trí 隔離 (-Q)" : "Vị trí lưu"}>
          <select value={line.location_id} onChange={(e) => set({ location_id: e.target.value })} className={inputClass} disabled={!product || line.result === "rejected"}>
            <option value="">— Chọn —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </select>
        </Field>
        {product && product.trace_lane !== "internal_lot" ? (
          <Field label={product.trace_lane === "beef" ? "Mã cá thể bò (個体識別番号, 10 số)" : "産地・取引 (gạo)"}>
            <input value={line.trace_code} onChange={(e) => set({ trace_code: e.target.value })} className={inputClass}
              inputMode={product.trace_lane === "beef" ? "numeric" : undefined} />
          </Field>
        ) : <div />}
      </div>
      {tempOk === false && (
        <div className="mt-3 grid gap-3 rounded-lg bg-red-50 p-3 sm:grid-cols-[1fr_auto]">
          <Field label="⚠ Nhiệt độ ngoài ngưỡng — ghi chú xử lý (bắt buộc)">
            <input required value={line.temp_note} onChange={(e) => set({ temp_note: e.target.value })} className={inputClass} placeholder="VD: đo lại vẫn vượt, chuyển 隔離 chờ QA" />
          </Field>
          <Field label="Kết quả">
            <select value={line.result} onChange={(e) => set({ result: e.target.value as LineDraft["result"], location_id: "" })} className={inputClass}>
              {hasQuarantine && <option value="hold">保留 — chuyển 隔離 chờ QA</option>}
              <option value="rejected">Từ chối — trả NCC</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}
