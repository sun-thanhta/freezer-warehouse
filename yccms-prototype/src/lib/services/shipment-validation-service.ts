// Validates the picker's allocations against the pick plan before the SQL guard runs (UX layer).
//   hard errors : ① 消費期限 reached (also logged as an immutable BR-EXP-02 exception), ② wrong band, ③ 隔離, stock/qty
//   exception   : ⑤ 日付逆転 → maker-checker request, approved by another manager
//   warning     : ④ delivery window violated (custom, not law) · agreement not yet agreed (business-review)

import type { Allocation } from "@/lib/rules/allocation-chain-rules";
import { WINDOW_LABEL } from "@/lib/rules/delivery-window-rules";
import type { PickPlan } from "./pick-plan-types";

export interface LineAllocation extends Allocation { order_line_id: string }

export interface BlockedLot { lot_id: string; lot_no: string; sku: string }

export interface ShipmentCheck {
  errors: string[];
  useByExpired: BlockedLot[];
  reversals: BlockedLot[];
  warnings: string[];
}

export function validateShipment(plan: PickPlan, allocations: LineAllocation[]): ShipmentCheck {
  const check: ShipmentCheck = { errors: [], useByExpired: [], reversals: [], warnings: [] };
  if (plan.order.status !== "open") check.errors.push("Đơn đã được giao, không thể xác nhận lại.");
  if (plan.pendingOverride) check.errors.push("Đơn đang có đề nghị ngoại lệ chờ quản lý duyệt.");

  for (const line of plan.lines) {
    const sku = line.product.sku;
    const mine = allocations.filter((a) => a.order_line_id === line.id);
    const total = mine.reduce((s, a) => s + a.qty, 0);
    if (total !== line.qty) check.errors.push(`${sku}: đã chọn ${total}/${line.qty} — phải phân bổ đủ số lượng đơn.`);
    if (!line.agreement) check.errors.push(`${sku}: khách chưa có hợp đồng khách-SKU.`);
    else if (!line.agreement.window_rule) {
      check.warnings.push(`${sku}: ${line.agreement.code} chưa chốt delivery window → business-review (không áp mặc định).`);
    }
    for (const a of mine) {
      const lot = line.lots.find((l) => l.id === a.lot_id);
      if (!lot) { check.errors.push(`${sku}: lô không hợp lệ hoặc hết tồn.`); continue; }
      const blocked = { lot_id: lot.id, lot_no: lot.lot_no, sku };
      if (a.qty <= 0 || a.qty > lot.qty_on_hand) check.errors.push(`${lot.lot_no}: số lượng ${a.qty} vượt tồn ${lot.qty_on_hand}.`);
      for (const code of lot.exclusions) {
        if (code === "use_by_expired") {
          check.useByExpired.push(blocked);
          check.errors.push(`${lot.lot_no}: 消費期限 ${lot.expiry_date} đã đến/quá — HARD STOP, không có ngoại lệ.`);
        }
        if (code === "zone_mismatch") check.errors.push(`${lot.lot_no}: đang nằm sai dải nhiệt (${lot.location}) — không được xuất.`);
        if (code === "quarantine") check.errors.push(`${lot.lot_no}: đang 隔離 — chờ QA release.`);
        if (code === "window_violation" && lot.window.rule) {
          check.warnings.push(`${lot.lot_no}: quá 納品期限 ${lot.window.deadline} (${WINDOW_LABEL[lot.window.rule]}, ${line.agreement?.code}) — tập quán thương mại, không phải hạn thực.`);
        }
        if (code === "date_reversal") check.reversals.push(blocked);
      }
    }
  }
  for (const a of allocations) {
    if (!plan.lines.some((l) => l.id === a.order_line_id)) check.errors.push("Có dòng phân bổ không thuộc đơn này.");
  }
  // The same lot may be entered twice: compare the TOTAL per lot with stock
  const perLot = new Map<string, number>();
  for (const a of allocations) perLot.set(a.lot_id, (perLot.get(a.lot_id) ?? 0) + a.qty);
  for (const [lotId, qty] of perLot) {
    const lot = plan.lines.flatMap((l) => l.lots).find((l) => l.id === lotId);
    if (lot && qty > lot.qty_on_hand) check.errors.push(`${lot.lot_no}: tổng ${qty} vượt tồn ${lot.qty_on_hand}.`);
  }
  return check;
}
