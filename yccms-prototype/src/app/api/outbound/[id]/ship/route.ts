import { ApiError, assertNoDbError, readJsonBody, uuidParam, withAuth } from "@/lib/api/api-route-helpers";
import { formatTempRange, isTempWithinRange } from "@/lib/rules/temperature-rules";
import { buildPickPlans } from "@/lib/services/pick-plan-service";
import { validateShipment, type BlockedLot, type LineAllocation } from "@/lib/services/shipment-validation-service";
import type { AuthContext } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };
interface ShipBody { allocations: LineAllocation[]; ship_temp_c: number | null; override_reason?: string }

async function logBlocked(auth: AuthContext, orderId: string, rule: "BR-DATE-01" | "BR-EXP-02", lots: BlockedLot[]) {
  if (lots.length === 0) return;
  // customer/product/dates are re-derived by the DB trigger; only the lot + rule come from here.
  // One row per rule × order × lot (repeated clicks do not flood the log). Logging never masks the real answer.
  const { error } = await auth.supabase.from("allocation_exceptions").upsert(lots.map((l) => ({
    rule, order_id: orderId, lot_id: l.lot_id, decision: "blocked", actor_id: auth.user.id,
    customer_id: 0, product_id: 0, lot_expiry: "1970-01-01", reference_date: "1970-01-01",
  })), { onConflict: "rule,order_id,lot_id,decision", ignoreDuplicates: true });
  if (error) console.error("[api] log exception:", error.message);
}

// Confirm shipment. 消費期限 → hard stop (logged). 日付逆転 → blocked (logged) unless a reason is given,
// in which case a maker-checker request is created for ANOTHER manager to approve.
export const POST = withAuth<Ctx>(async (req, auth, ctx) => {
  const id = uuidParam((await ctx.params).id);
  const body = await readJsonBody<ShipBody>(req);
  const [plan] = await buildPickPlans(auth.supabase, { orderId: id });
  if (!plan) throw new ApiError(404, "Không tìm thấy đơn xuất");

  const allocations = (body.allocations ?? []).map((a) => ({ ...a, qty: Number(a.qty) })).filter((a) => a.qty > 0);
  const check = validateShipment(plan, allocations);
  const temp = body.ship_temp_c === null || body.ship_temp_c === undefined ? NaN : Number(body.ship_temp_c);
  if (Number.isNaN(temp)) check.errors.push("Bắt buộc ghi nhiệt độ hàng khi xuất.");
  else if (!isTempWithinRange(temp, plan.shipTempRange)) {
    check.errors.push(`Nhiệt độ khi xuất ${temp}°C ngoài ngưỡng ${formatTempRange(plan.shipTempRange)} — xử lý chuỗi lạnh trước khi giao.`);
  }
  if (check.errors.length) {
    await logBlocked(auth, plan.order.id, "BR-EXP-02", check.useByExpired);
    throw new ApiError(422, "Chưa thể xác nhận giao", { errors: check.errors });
  }

  if (check.reversals.length) {
    const reason = (body.override_reason ?? "").trim();
    if (!reason) {
      await logBlocked(auth, plan.order.id, "BR-DATE-01", check.reversals);
      throw new ApiError(409, "CHẶN: vi phạm 日付逆転禁止. Chọn lô khác, hoặc nhập lý do để gửi đề nghị ngoại lệ cho quản lý duyệt.",
        { reversals: check.reversals });
    }
    const { data, error } = await auth.supabase.rpc("request_override", {
      p_order_id: plan.order.id, p_allocations: allocations, p_ship_temp: temp, p_reason: reason,
    });
    if (error?.code === "23505") throw new ApiError(409, "Đơn này đã có đề nghị ngoại lệ đang chờ duyệt.");
    assertNoDbError(error, "Gửi đề nghị ngoại lệ");
    return { ok: true, requested: true, requestId: data, warnings: check.warnings };
  }

  const { error } = await auth.supabase.rpc("confirm_shipment", { p_order_id: plan.order.id, p_allocations: allocations, p_ship_temp: temp });
  assertNoDbError(error, "Xác nhận giao");
  return { ok: true, requested: false, warnings: check.warnings };
});
