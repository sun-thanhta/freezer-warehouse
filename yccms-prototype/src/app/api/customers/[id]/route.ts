import { ApiError, assertNoDbError, intParam, withAuth } from "@/lib/api/api-route-helpers";
import { isIsoDate } from "@/lib/rules/date-utils";

type Ctx = { params: Promise<{ id: string }> };

// Customer delivery history (DR-HIST-01, basis of 日付逆転 per customer × SKU), filterable by SKU / period.
export const GET = withAuth<Ctx>(async (req, { supabase }, ctx) => {
  const id = intParam((await ctx.params).id);
  const params = new URL(req.url).searchParams;
  const { data: customer, error } = await supabase.from("customers").select("id, code, name").eq("id", id).maybeSingle();
  assertNoDbError(error, "Đọc khách hàng");
  if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng");

  for (const key of ["from", "to"]) {
    if (params.get(key) && !isIsoDate(params.get(key))) throw new ApiError(400, "Ngày lọc không hợp lệ");
  }
  let query = supabase.from("delivery_history")
    .select("id, qty, expiry_date, delivered_at, order:outbound_orders(id, code), lot:lots(lot_no), product:products!inner(id, sku, name, expiry_type)")
    .eq("customer_id", id).order("delivered_at", { ascending: false });
  if (params.get("sku")) query = query.eq("product.sku", params.get("sku")!);
  if (params.get("from")) query = query.gte("delivered_at", params.get("from")!);
  if (params.get("to")) query = query.lte("delivered_at", `${params.get("to")}T23:59:59+09:00`);
  const { data: history, error: hErr } = await query;
  assertNoDbError(hErr, "Đọc lịch sử giao");
  return { customer, history };
});
