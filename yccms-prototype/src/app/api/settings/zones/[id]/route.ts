import { ApiError, assertNoDbError, intParam, readJsonBody, withAuth } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };
const toNum = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

// US-06: Yuki's self-declared zone thresholds. Manager only; audited by DB trigger.
export const PATCH = withAuth<Ctx>(async (req, auth, ctx) => {
  if (auth.profile.role !== "manager") throw new ApiError(403, "Chỉ quản lý được đổi ngưỡng nhiệt.");
  const id = intParam((await ctx.params).id);
  const body = await readJsonBody<{ min_c: unknown; max_c: unknown }>(req);
  const min_c = toNum(body.min_c), max_c = toNum(body.max_c);
  if ([min_c, max_c].some((v) => v !== null && Number.isNaN(v))) throw new ApiError(422, "Ngưỡng phải là số");
  if (min_c === null && max_c === null) throw new ApiError(422, "Cần ít nhất một ngưỡng (min hoặc max)");
  if (min_c !== null && max_c !== null && min_c > max_c) throw new ApiError(422, "Ngưỡng min phải ≤ max");

  const { data: before } = await auth.supabase.from("temperature_zones").select("name, min_c, max_c").eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "Không tìm thấy dải nhiệt");
  const { error } = await auth.supabase.from("temperature_zones").update({ min_c, max_c, updated_at: new Date().toISOString() }).eq("id", id);
  assertNoDbError(error, "Cập nhật dải nhiệt");
  return { ok: true };
});
