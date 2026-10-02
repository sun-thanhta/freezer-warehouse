import type { AllocationSuggestion, ExclusionCode } from "@/lib/rules/allocation-chain-rules";
import type { WindowCheck, WindowRule } from "@/lib/rules/delivery-window-rules";
import type { TempRange } from "@/lib/rules/temperature-rules";

export interface PlanCustomer { id: number; code: string; name: string }

export interface PlanProduct {
  id: number;
  sku: string;
  name: string;
  unit: string;
  zone_id: number;
  expiry_type: "best_before" | "use_by";
  trace_lane: "rice" | "beef" | "internal_lot";
  zone: { name: string; min_c: number | null; max_c: number | null };
}

export interface PlanAgreement { code: string; delivery_term: string; window_rule: WindowRule | null }

export interface PlanLot {
  id: string;
  lot_no: string;
  mfg_date: string;
  expiry_date: string;
  received_at: string;
  qty_on_hand: number;
  status: "available" | "quarantine" | "scrapped";
  location: string | null;
  location_zone_id: number | null;
  trace_code: string | null;
  exclusions: ExclusionCode[]; // every broken rule, FR-OUT-02 order
  window: WindowCheck;
}

export interface LastDelivery { expiry_date: string; lot_no: string; delivered_at: string }

export type LineStatus = "ok" | "date_reversal" | "insufficient";

export interface PlanLine {
  id: string;
  qty: number;
  product: PlanProduct;
  agreement: PlanAgreement | null;
  lastDelivery: LastDelivery | null;
  lots: PlanLot[];
  suggestion: AllocationSuggestion;
  status: LineStatus;
  /** Qty only shippable by breaking 日付逆転 (every other rule passes) → maker-checker exception. */
  reversalOnlyQty: number;
}

export interface PendingOverrideItem { sku: string; lot_no: string; qty: number; expiry_date: string; isReversal: boolean }
export interface PendingOverride {
  id: string; reason: string; requested_email: string | null; created_at: string; ship_temp_c: number;
  items: PendingOverrideItem[]; // what the checker is actually approving
}

export interface PickPlan {
  order: { id: string; code: string; ship_date: string; status: "open" | "shipped"; ship_temp_c: number | null; shipped_at: string | null };
  customer: PlanCustomer;
  lines: PlanLine[];
  /** Range the ship temperature must fall inside (coldest band of the order). */
  shipTempRange: TempRange;
  pendingOverride: PendingOverride | null;
}
