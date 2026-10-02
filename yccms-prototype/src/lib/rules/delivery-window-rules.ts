// Delivery window per customer × SKU agreement (BR-DELWIN-01, R-04) — a TRADE CUSTOM, not law.
//   ONE_THIRD / ONE_HALF : 納品期限 = mfg + floor((expiry − mfg) × ratio)
//   LABEL_DATE_ONLY      : compare with the label date only (no ratio)
//   null                 : not yet agreed (AGR-008 / AGR-014) → business-review, NEVER defaulted
// Violations exclude a lot from automatic allocation (FR-OUT-02 step ④) but only WARN on a manual pick.

import { addDays, daysBetween } from "./date-utils";

export type WindowRule = "ONE_THIRD" | "ONE_HALF" | "LABEL_DATE_ONLY";
export const WINDOW_LABEL: Record<WindowRule, string> = { ONE_THIRD: "1/3", ONE_HALF: "1/2", LABEL_DATE_ONLY: "Chỉ hạn trên nhãn" };
const RATIO = { ONE_THIRD: 1 / 3, ONE_HALF: 1 / 2 } as const;

export function deliveryDeadline(mfgDate: string, expiryDate: string, rule: WindowRule): string {
  if (rule === "LABEL_DATE_ONLY") return expiryDate;
  return addDays(mfgDate, Math.floor(daysBetween(mfgDate, expiryDate) * RATIO[rule]));
}

export interface WindowCheck {
  status: "ok" | "violated" | "review";
  rule: WindowRule | null;
  deadline: string | null;
}

export function checkDeliveryWindow(
  lot: { mfg_date: string; expiry_date: string }, rule: WindowRule | null, shipDate: string,
): WindowCheck {
  if (!rule) return { status: "review", rule: null, deadline: null };
  const deadline = deliveryDeadline(lot.mfg_date, lot.expiry_date, rule);
  return { status: shipDate > deadline ? "violated" : "ok", rule, deadline };
}
