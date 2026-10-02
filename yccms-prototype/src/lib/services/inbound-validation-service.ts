// Server-side inbound inspection (FR-REC-02..05) mirroring the SQL guard in confirm_inbound_receipt:
// P0 fields, temperature vs Yuki's band thresholds, deviation → reject or 保留 (隔離 location of the band),
// 消費期限 already reached on arrival, traceability lane (rice 産地・取引 / beef 10-digit id).

import { ApiError } from "@/lib/api/api-route-helpers";
import { addDays, isIsoDate, todayJst } from "@/lib/rules/date-utils";
import { formatTempRange, isTempWithinRange } from "@/lib/rules/temperature-rules";
import { traceCodeProblem, type TraceLane } from "@/lib/rules/traceability-rules";

export type InboundResult = "accepted" | "rejected" | "hold";

export interface InboundLineInput {
  product_id: number;
  lot_no: string;
  mfg_date: string;
  expiry_date: string;
  qty: number;
  temp_c: number | null;
  temp_note?: string;
  trace_code?: string;
  location_id?: number | null;
  result: InboundResult;
}

export interface InboundInput { supplier_id: number; arrival_date: string; note?: string; lines: InboundLineInput[] }

interface ProductRow { id: number; sku: string; zone_id: number; expiry_type: string; trace_lane: TraceLane }
interface ZoneRow { id: number; min_c: number | null; max_c: number | null }
interface LocationRow { id: number; zone_id: number; is_quarantine: boolean }

export function inspectInboundLines(input: InboundInput, products: ProductRow[], zones: ZoneRow[], locations: LocationRow[]) {
  const errors: string[] = [];
  if (!input.supplier_id) errors.push("Chưa chọn nhà cung cấp.");
  if (!isIsoDate(input.arrival_date)) errors.push("Ngày nhận không hợp lệ.");
  else if (input.arrival_date > todayJst() || input.arrival_date < addDays(todayJst(), -7)) {
    errors.push("Ngày nhận chỉ được trong 7 ngày gần nhất và không ở tương lai.");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) errors.push("Phiếu nhập phải có ít nhất 1 dòng.");

  const lines = (input.lines ?? []).map((line, i) => {
    const product = products.find((p) => p.id === Number(line.product_id));
    if (!product) { errors.push(`Dòng ${i + 1}: chưa chọn sản phẩm.`); return null; }
    const n = `Dòng ${i + 1} (${product.sku})`;
    const zone = zones.find((z) => z.id === product.zone_id)!;
    const range = { min: zone.min_c, max: zone.max_c };
    const temp = line.temp_c === null || line.temp_c === undefined ? NaN : Number(line.temp_c);
    const qty = Number(line.qty);
    const result: InboundResult = ["accepted", "rejected", "hold"].includes(line.result) ? line.result : "accepted";

    if (!(line.lot_no ?? "").trim()) errors.push(`${n}: thiếu số lô.`);
    if (!isIsoDate(line.mfg_date) || !isIsoDate(line.expiry_date)) errors.push(`${n}: thiếu ngày SX / hạn dùng.`);
    else if (line.expiry_date < line.mfg_date) errors.push(`${n}: hạn dùng trước ngày sản xuất.`);
    else if (result === "accepted" && product.expiry_type === "use_by" && line.expiry_date <= input.arrival_date) {
      errors.push(`${n}: 消費期限 đã đến/quá ngay khi nhận — không được nhập kho.`);
    }
    if (!Number.isInteger(qty) || qty <= 0) errors.push(`${n}: số lượng phải là số nguyên > 0.`);
    if (Number.isNaN(temp)) errors.push(`${n}: bắt buộc nhập nhiệt độ đo khi nhận.`);

    const tempOk = !Number.isNaN(temp) && isTempWithinRange(temp, range);
    if (!Number.isNaN(temp) && !tempOk && (result === "accepted" || !(line.temp_note ?? "").trim())) {
      errors.push(`${n}: nhiệt ${temp}°C ngoài ngưỡng ${formatTempRange(range)} — phải chọn Từ chối hoặc 保留 (隔離) và ghi chú.`);
    }
    if (result !== "rejected") {
      const traceProblem = traceCodeProblem(product.trace_lane, line.trace_code);
      if (traceProblem) errors.push(`${n}: ${traceProblem}`);
      const location = locations.find((l) => l.id === Number(line.location_id));
      if (!location || location.zone_id !== product.zone_id || location.is_quarantine !== (result === "hold")) {
        errors.push(`${n}: ${result === "hold" ? "chọn vị trí 隔離 (-Q) cùng dải nhiệt" : "chọn vị trí lưu thường cùng dải nhiệt"}.`);
      }
    }
    return {
      product_id: product.id, lot_no: (line.lot_no ?? "").trim(), mfg_date: line.mfg_date, expiry_date: line.expiry_date, qty,
      temp_c: temp, temp_note: line.temp_note ?? "", trace_code: line.trace_code ?? "",
      location_id: result === "rejected" ? null : Number(line.location_id) || null, result,
    };
  });

  if (errors.length) throw new ApiError(422, "Phiếu nhập chưa hợp lệ", errors);
  return lines;
}
