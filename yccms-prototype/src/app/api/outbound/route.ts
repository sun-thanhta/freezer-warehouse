import { withAuth } from "@/lib/api/api-route-helpers";
import { buildPickPlans } from "@/lib/services/pick-plan-service";

// Order list with a per-order pre-check summary from the same pick-plan engine (FR-OUT-02).
export const GET = withAuth(async (_req, { supabase }) => {
  const plans = await buildPickPlans(supabase, {});
  return {
    orders: plans.map((p) => {
      const open = p.order.status === "open";
      const count = (pred: (l: (typeof p.lines)[number]) => boolean) => (open ? p.lines.filter(pred).length : 0);
      return {
        ...p.order,
        customer: { code: p.customer.code, name: p.customer.name },
        lineCount: p.lines.length,
        totalQty: p.lines.reduce((s, l) => s + l.qty, 0),
        reversalLines: count((l) => l.status === "date_reversal"),
        shortLines: count((l) => l.status === "insufficient"),
        reviewLines: count((l) => !l.agreement?.window_rule),
        excludedLots: open ? p.lines.reduce((s, l) => s + l.suggestion.excluded.length, 0) : 0,
        pendingOverride: Boolean(p.pendingOverride),
      };
    }),
  };
});
