import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";

// Customers with their customer × SKU agreements (R-04) and delivery summary.
export const GET = withAuth(async (_req, { supabase }) => {
  const [customers, summary, agreements] = await Promise.all([
    supabase.from("customers").select("id, code, name").order("code"),
    supabase.rpc("customer_delivery_summary"),
    supabase.from("customer_sku_agreements")
      .select("id, code, customer_id, delivery_term, window_rule, effective_from, updated_at, product:products(sku, name, expiry_type)")
      .order("code"),
  ]);
  for (const r of [customers, summary, agreements]) assertNoDbError(r.error, "Đọc khách hàng");
  const sums = (summary.data ?? []) as { customer_id: number; deliveries: number; last_delivered_at: string | null }[];
  return {
    customers: (customers.data ?? []).map((c) => {
      const s = sums.find((x) => x.customer_id === c.id);
      return {
        ...c, deliveries: s?.deliveries ?? 0, lastDeliveredAt: s?.last_delivered_at ?? null,
        agreements: (agreements.data ?? []).filter((a) => a.customer_id === c.id),
      };
    }),
  };
});
