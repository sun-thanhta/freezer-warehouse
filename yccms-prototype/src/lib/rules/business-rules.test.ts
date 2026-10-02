import { describe, expect, it } from "vitest";
import { evaluateLot, suggestAllocation, type ChainContext, type ChainLot } from "./allocation-chain-rules";
import { addDays } from "./date-utils";
import { checkDeliveryWindow, deliveryDeadline } from "./delivery-window-rules";
import { isTempWithinRange } from "./temperature-rules";
import { checkBeefId, traceCodeProblem } from "./traceability-rules";

const CHILLED = 2;
const lot = (id: string, expiry: string, qty: number, extra: Partial<ChainLot> = {}): ChainLot => ({
  id, lot_no: id, mfg_date: addDays(expiry, -16), expiry_date: expiry, received_at: "2026-09-01T08:00",
  qty_on_hand: qty, status: "available", location_zone_id: CHILLED, ...extra,
});
const ctx = (over: Partial<ChainContext> = {}): ChainContext => ({
  expiryType: "best_before", productZoneId: CHILLED, windowRule: "ONE_HALF", lastDeliveredExpiry: null, shipDate: "2026-09-10", ...over,
});

describe("BR-DATE-01 日付逆転 — per customer × SKU history, never today (R-06 fixture)", () => {
  it("US-02: CUS-003/CHI-002 received 2026-09-20 → a 2026-09-18 lot is blocked although far from today", () => {
    expect(evaluateLot(lot("L18", "2026-09-18", 10), ctx({ lastDeliveredExpiry: "2026-09-20", windowRule: "LABEL_DATE_ONLY" }))).toEqual(["date_reversal"]);
  });
  it("CUS-004 without history for the SKU is not affected by CUS-003's history", () => {
    expect(evaluateLot(lot("L18", "2026-09-18", 10), ctx({ lastDeliveredExpiry: null, windowRule: "LABEL_DATE_ONLY" }))).toEqual([]);
  });
  it("equal expiry to the last delivery is allowed", () => {
    expect(evaluateLot(lot("L20", "2026-09-20", 10), ctx({ lastDeliveredExpiry: "2026-09-20", windowRule: "LABEL_DATE_ONLY" }))).toEqual([]);
  });
});

describe("FR-OUT-02 exclusion chain + FEFO/FIFO", () => {
  it("reports every broken rule in the fixed order ①→⑤", () => {
    const bad = lot("BAD", "2026-09-10", 5, { status: "quarantine", location_zone_id: 3 });
    expect(evaluateLot(bad, ctx({ expiryType: "use_by", lastDeliveredExpiry: "2026-09-30" })))
      .toEqual(["use_by_expired", "zone_mismatch", "quarantine", "window_violation", "date_reversal"]);
  });
  it("① 消費期限 reached on the ship date is a hard stop; 賞味期限 is not", () => {
    expect(evaluateLot(lot("U", "2026-09-10", 5), ctx({ expiryType: "use_by", windowRule: "LABEL_DATE_ONLY" }))).toContain("use_by_expired");
    expect(evaluateLot(lot("B", "2026-09-10", 5), ctx({ expiryType: "best_before", windowRule: "LABEL_DATE_ONLY" }))).toEqual([]);
  });
  it("US-05: quarantined lot never suggested even with the earliest expiry", () => {
    const s = suggestAllocation([lot("Q", "2026-09-25", 10, { status: "quarantine" }), lot("OK", "2026-09-28", 10)], 5, ctx());
    expect(s.allocations).toEqual([{ lot_id: "OK", qty: 5 }]);
    expect(s.excluded).toEqual([{ lot_id: "Q", code: "quarantine" }]);
  });
  it("same expiry → earliest receipt first (FIFO tie-break)", () => {
    const s = suggestAllocation([
      lot("LATE", "2026-12-01", 10, { received_at: "2026-09-05T08:00" }),
      lot("EARLY", "2026-12-01", 10, { received_at: "2026-08-20T08:00" }),
    ], 12, ctx());
    expect(s.allocations).toEqual([{ lot_id: "EARLY", qty: 10 }, { lot_id: "LATE", qty: 2 }]);
  });
  it("only reversal lots left → shortfall (needs a maker-checker exception)", () => {
    const s = suggestAllocation([lot("Y1", "2026-09-20", 48), lot("Y2", "2026-09-24", 24)], 24, ctx({ lastDeliveredExpiry: "2026-09-30" }));
    expect(s.allocations).toEqual([]);
    expect(s.shortfall).toBe(24);
    expect(s.excluded.map((e) => e.code)).toEqual(["date_reversal", "date_reversal"]);
  });
});

describe("BR-DELWIN-01 delivery window (custom, per agreement)", () => {
  it("ONE_THIRD / ONE_HALF deadlines from mfg; LABEL_DATE_ONLY = label date", () => {
    expect(deliveryDeadline("2026-09-01", "2026-09-22", "ONE_THIRD")).toBe("2026-09-08");
    expect(deliveryDeadline("2026-09-01", "2026-09-22", "ONE_HALF")).toBe("2026-09-11");
    expect(deliveryDeadline("2026-09-01", "2026-09-22", "LABEL_DATE_ONLY")).toBe("2026-09-22");
  });
  it("undetermined agreement (AGR-008/014) → review, never a default ratio", () => {
    expect(checkDeliveryWindow({ mfg_date: "2026-09-01", expiry_date: "2026-09-22" }, null, "2026-09-20"))
      .toEqual({ status: "review", rule: null, deadline: null });
  });
  it("violation excludes the lot from the automatic suggestion (step ④)", () => {
    const old = { ...lot("OLD", "2026-12-31", 10), mfg_date: "2026-01-01" };
    const s = suggestAllocation([old, lot("NEW", "2027-06-01", 10, { mfg_date: "2026-09-01" })], 5, ctx({ windowRule: "ONE_THIRD" }));
    expect(s.excluded).toEqual([{ lot_id: "OLD", code: "window_violation" }]);
    expect(s.allocations[0].lot_id).toBe("NEW");
  });
});

describe("temperature & traceability", () => {
  it("冷蔵 0–5°C: 5.0 ok, 5.1 deviation; 冷凍 only an upper bound", () => {
    expect(isTempWithinRange(5, { min: 0, max: 5 })).toBe(true);
    expect(isTempWithinRange(5.1, { min: 0, max: 5 })).toBe(false);
    expect(isTempWithinRange(-25, { min: null, max: -18 })).toBe(true);
  });
  it("beef id: 10 digits ok, 9 digits → business-review (not rounded), else invalid", () => {
    expect(checkBeefId("1408123456")).toBe("ok");
    expect(checkBeefId("140812345")).toBe("review");
    expect(checkBeefId("14081234AB")).toBe("invalid");
    expect(traceCodeProblem("rice", "")).toMatch(/産地/);
    expect(traceCodeProblem("internal_lot", "")).toBeNull();
  });
});
