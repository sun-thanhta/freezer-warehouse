import { ApiError, assertNoDbError, uuidParam, withAuth } from "@/lib/api/api-route-helpers";
import { buildPickPlans } from "@/lib/services/pick-plan-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (_req, { supabase }, ctx) => {
  const id = uuidParam((await ctx.params).id);
  const [plan] = await buildPickPlans(supabase, { orderId: id });
  if (!plan) throw new ApiError(404, "Không tìm thấy đơn xuất");

  // Shipped order: show what was actually delivered (from delivery history)
  let delivered: unknown[] = [];
  if (plan.order.status === "shipped") {
    const { data, error } = await supabase.from("delivery_history")
      .select("qty, expiry_date, delivered_at, lot:lots(lot_no), product:products(sku, name)")
      .eq("order_id", id);
    assertNoDbError(error, "Đọc lịch sử giao của đơn");
    delivered = data ?? [];
  }
  return { plan, delivered };
});
