import { ApiError, assertNoDbError, intParam, readJsonBody, withAuth } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };
const RULES = ["ONE_THIRD", "ONE_HALF", "LABEL_DATE_ONLY"];

// SCR-03 / US-04: set the delivery window of a customer × SKU agreement (e.g. finally agree AGR-008/014).
// Manager only (column-level grant + RLS), audited by DB trigger, effective for the next allocation.
export const PATCH = withAuth<Ctx>(async (req, auth, ctx) => {
  if (auth.profile.role !== "manager") throw new ApiError(403, "Chỉ quản lý được đổi delivery window.");
  const id = intParam((await ctx.params).id);
  const { window_rule } = await readJsonBody<{ window_rule: string }>(req);
  if (!RULES.includes(window_rule)) throw new ApiError(422, "Quy tắc chỉ nhận ONE_THIRD / ONE_HALF / LABEL_DATE_ONLY");
  const { data: before } = await auth.supabase.from("customer_sku_agreements").select("code, window_rule").eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "Không tìm thấy hợp đồng");
  const { error } = await auth.supabase.from("customer_sku_agreements")
    .update({ window_rule, updated_at: new Date().toISOString() }).eq("id", id);
  assertNoDbError(error, "Cập nhật delivery window");
  return { ok: true };
});
