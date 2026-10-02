import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";
import { addDays, daysBetween, todayJst } from "@/lib/rules/date-utils";
import { buildPickPlans } from "@/lib/services/pick-plan-service";

export const GET = withAuth(async (_req, { supabase }) => {
  const today = todayJst();
  const weekAgo = addDays(today, -7);
  const [inbound, lots, tempFails, events, pending, reviewAgr, audit, plans] = await Promise.all([
    supabase.from("inbound_receipts").select("id", { count: "exact", head: true }).eq("arrival_date", today),
    supabase.from("lots").select("expiry_date, status, product:products(near_expiry_days, expiry_type)").gt("qty_on_hand", 0),
    supabase.from("inbound_lines").select("id, receipt:inbound_receipts!inner(arrival_date)", { count: "exact", head: true })
      .eq("temp_ok", false).gte("receipt.arrival_date", weekAgo),
    supabase.from("allocation_exceptions").select("rule, decision").gte("created_at", weekAgo),
    supabase.from("override_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("customer_sku_agreements").select("id", { count: "exact", head: true }).is("window_rule", null),
    supabase.from("audit_logs").select("id, action, actor_email, created_at, entity_id").order("created_at", { ascending: false }).limit(6),
    buildPickPlans(supabase, { openOnly: true }),
  ]);
  for (const r of [inbound, lots, tempFails, events, pending, reviewAgr, audit]) assertNoDbError(r.error, "Đọc dashboard");

  const stock = (lots.data ?? []) as unknown as { expiry_date: string; status: string; product: { near_expiry_days: number; expiry_type: string } | null }[];
  const lines = plans.flatMap((p) => p.lines);
  const ev = events.data ?? [];
  return {
    today,
    inboundToday: inbound.count ?? 0,
    openOrders: plans.length,
    reversalBlocked: lines.filter((l) => l.status === "date_reversal").length,
    pendingApprovals: pending.count ?? 0,
    excludedLots: lines.reduce((s, l) => s + l.suggestion.excluded.length, 0),
    quarantineLots: stock.filter((l) => l.status === "quarantine").length,
    nearExpiryLots: stock.filter((l) => { const d = daysBetween(today, l.expiry_date); return d >= 0 && d <= (l.product?.near_expiry_days ?? 0); }).length,
    useByExpiredLots: stock.filter((l) => l.product?.expiry_type === "use_by" && l.expiry_date <= today).length,
    reviewAgreements: reviewAgr.count ?? 0,
    tempFailures7d: tempFails.count ?? 0,
    blockedEvents7d: ev.filter((e) => e.decision === "blocked").length,
    overrides7d: ev.filter((e) => e.decision === "overridden").length,
    recentAudit: audit.data ?? [],
  };
});
