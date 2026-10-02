import { ApiError, assertNoDbError, uuidParam, withAuth } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAuth<Ctx>(async (_req, { supabase }, ctx) => {
  const id = uuidParam((await ctx.params).id);
  const { data, error } = await supabase.from("inbound_receipts")
    .select(`id, code, arrival_date, note, created_at, supplier:suppliers(code, name),
      lines:inbound_lines(id, lot_no, mfg_date, expiry_date, qty, temp_c, temp_ok, temp_note, trace_code, result,
        location:locations(code), product:products(sku, name, unit, expiry_type, trace_lane, zone:temperature_zones(name, min_c, max_c)))`)
    .eq("id", id).maybeSingle();
  assertNoDbError(error, "Đọc phiếu nhập");
  if (!data) throw new ApiError(404, "Không tìm thấy phiếu nhập");
  return { receipt: data };
});
