import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";
import { buildPickPlans } from "@/lib/services/pick-plan-service";

// 日付逆転 alert centre: (1) open order lines at risk BEFORE shipping, (2) maker-checker queue,
// (3) immutable exception log (blocked 日付逆転 / 消費期限 attempts, approved overrides).
export const GET = withAuth(async (_req, { supabase }) => {
  const plans = await buildPickPlans(supabase, { openOnly: true });
  const risks = plans.flatMap((p) => p.lines
    .filter((l) => l.lots.some((lot) => lot.exclusions.includes("date_reversal")))
    .map((l) => ({
      order: { id: p.order.id, code: p.order.code, ship_date: p.order.ship_date },
      customer: { code: p.customer.code, name: p.customer.name },
      product: { sku: l.product.sku, name: l.product.name },
      qty: l.qty,
      lastDelivery: l.lastDelivery,
      reversalLots: l.lots.filter((lot) => lot.exclusions.includes("date_reversal"))
        .map((x) => ({ lot_no: x.lot_no, expiry_date: x.expiry_date, qty_on_hand: x.qty_on_hand })),
      severity: l.status === "date_reversal" ? "blocked" : "avoided",
      shortfall: l.suggestion.shortfall,
      pending: Boolean(p.pendingOverride),
    })));

  const [requests, events] = await Promise.all([
    supabase.from("override_requests").select(`id, status, reason, requested_email, decided_email, decision_note, created_at, decided_at,
      ship_temp_c, order:outbound_orders(id, code, customer:customers(code, name))`).order("created_at", { ascending: false }).limit(50),
    supabase.from("allocation_exceptions").select(`id, rule, decision, reason, actor_email, approver_email, created_at, lot_expiry,
      reference_date, order:outbound_orders(id, code), customer:customers(code, name), product:products(sku, name), lot:lots(lot_no)`)
      .order("created_at", { ascending: false }).limit(100),
  ]);
  assertNoDbError(requests.error, "Đọc đề nghị ngoại lệ");
  assertNoDbError(events.error, "Đọc nhật ký ngoại lệ");
  return { risks, requests: requests.data, events: events.data };
});
