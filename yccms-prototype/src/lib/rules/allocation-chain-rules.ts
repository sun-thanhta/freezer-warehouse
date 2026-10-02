// Allocation per FR-OUT-02 — fixed exclusion order, then FEFO with FIFO tie-break (BR-FEFO-01):
//   ① 消費期限 reached/passed (BR-EXP-02, hard stop)   ② stored in the wrong band (BR-TEMP-02)
//   ③ quarantined (FR-INV-05)                          ④ delivery window violated (BR-DELWIN-01)
//   ⑤ 日付逆転: expiry EARLIER than the latest expiry already delivered to the SAME customer × SKU
//      (BR-DATE-01) — compared with that pair's history, never with today, never borrowed from others.

import { checkDeliveryWindow, type WindowRule } from "./delivery-window-rules";

export type ExclusionCode = "use_by_expired" | "zone_mismatch" | "quarantine" | "window_violation" | "date_reversal";
export const EXCLUSION_ORDER: ExclusionCode[] = ["use_by_expired", "zone_mismatch", "quarantine", "window_violation", "date_reversal"];

export interface ChainLot {
  id: string;
  lot_no: string;
  mfg_date: string;
  expiry_date: string;
  received_at: string;
  qty_on_hand: number;
  status: "available" | "quarantine" | "scrapped";
  location_zone_id: number | null;
}

export interface ChainContext {
  expiryType: "best_before" | "use_by";
  productZoneId: number;
  windowRule: WindowRule | null;
  lastDeliveredExpiry: string | null;
  shipDate: string;
}

export interface Allocation {
  lot_id: string;
  qty: number;
}

export function isDateReversal(lotExpiry: string, lastDeliveredExpiry: string | null): boolean {
  return lastDeliveredExpiry !== null && lotExpiry < lastDeliveredExpiry;
}

/** Every rule the lot breaks, in chain order (a lot can break several). */
export function evaluateLot(lot: ChainLot, ctx: ChainContext): ExclusionCode[] {
  const hits: ExclusionCode[] = [];
  if (ctx.expiryType === "use_by" && lot.expiry_date <= ctx.shipDate) hits.push("use_by_expired");
  if (lot.location_zone_id !== ctx.productZoneId) hits.push("zone_mismatch");
  if (lot.status !== "available") hits.push("quarantine");
  if (checkDeliveryWindow(lot, ctx.windowRule, ctx.shipDate).status === "violated") hits.push("window_violation");
  if (isDateReversal(lot.expiry_date, ctx.lastDeliveredExpiry)) hits.push("date_reversal");
  return hits;
}

/** FEFO: earliest expiry first; same expiry → earliest receipt first (FIFO). */
export function sortFefo<T extends Pick<ChainLot, "expiry_date" | "received_at">>(lots: T[]): T[] {
  return [...lots].sort(
    (a, b) => a.expiry_date.localeCompare(b.expiry_date) || a.received_at.localeCompare(b.received_at),
  );
}

export interface AllocationSuggestion {
  allocations: Allocation[];
  shortfall: number;
  excluded: { lot_id: string; code: ExclusionCode }[]; // first failing step per lot
}

export function suggestAllocation(lots: ChainLot[], qtyNeeded: number, ctx: ChainContext): AllocationSuggestion {
  const result: AllocationSuggestion = { allocations: [], shortfall: 0, excluded: [] };
  let remaining = qtyNeeded;
  for (const lot of sortFefo(lots)) {
    if (lot.qty_on_hand <= 0) continue;
    const [first] = evaluateLot(lot, ctx);
    if (first) { result.excluded.push({ lot_id: lot.id, code: first }); continue; }
    if (remaining <= 0) continue;
    const take = Math.min(remaining, lot.qty_on_hand);
    result.allocations.push({ lot_id: lot.id, qty: take });
    remaining -= take;
  }
  result.shortfall = Math.max(remaining, 0);
  return result;
}
