import { ApiError, assertNoDbError, intParam, readJsonBody, withAuth } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };

// US-04 / US-05: expiry type per SKU (賞味期限 vs 消費期限) and near-expiry threshold. Manager only; audited by DB trigger.
export const PATCH = withAuth<Ctx>(async (req, auth, ctx) => {
  if (auth.profile.role !== "manager") throw new ApiError(403, "Chỉ quản lý được đổi cấu hình SKU.");
  const id = intParam((await ctx.params).id);
  const body = await readJsonBody<{ expiry_type: string; near_expiry_days: unknown }>(req);
  const days = Number(body.near_expiry_days);
  if (body.expiry_type !== "best_before" && body.expiry_type !== "use_by") throw new ApiError(422, "Loại hạn không hợp lệ");
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new ApiError(422, "Ngưỡng cận hạn phải là số ngày 0–365");

  const { data: before } = await auth.supabase.from("products").select("sku, expiry_type, near_expiry_days").eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "Không tìm thấy SKU");
  const { error } = await auth.supabase.from("products")
    .update({ expiry_type: body.expiry_type, near_expiry_days: days, updated_at: new Date().toISOString() }).eq("id", id);
  assertNoDbError(error, "Cập nhật SKU");
  return { ok: true };
});
