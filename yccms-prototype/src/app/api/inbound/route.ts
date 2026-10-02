import { ApiError, assertNoDbError, readJsonBody, withAuth } from "@/lib/api/api-route-helpers";
import { inspectInboundLines, type InboundInput } from "@/lib/services/inbound-validation-service";

export const GET = withAuth(async (_req, { supabase }) => {
  const { data, error } = await supabase.from("inbound_receipts")
    .select("id, code, arrival_date, note, created_at, supplier:suppliers(code, name), lines:inbound_lines(qty, temp_ok, result)")
    .order("arrival_date", { ascending: false }).order("code", { ascending: false });
  assertNoDbError(error, "Đọc phiếu nhập");
  return { receipts: data };
});

// Create + inspect a receipt. Accepted lines become stock lots (atomic RPC).
export const POST = withAuth(async (req, { supabase }) => {
  const input = await readJsonBody<InboundInput>(req);
  const ids = (input.lines ?? []).map((l) => Number(l.product_id)).filter(Boolean);
  const [products, zones, locations] = await Promise.all([
    supabase.from("products").select("id, sku, zone_id, expiry_type, trace_lane").in("id", ids.length ? ids : [0]),
    supabase.from("temperature_zones").select("id, min_c, max_c"),
    supabase.from("locations").select("id, zone_id, is_quarantine"),
  ]);
  for (const r of [products, zones, locations]) assertNoDbError(r.error, "Đọc danh mục");
  const lines = inspectInboundLines(input, products.data ?? [], zones.data ?? [], locations.data ?? []);

  const { data, error } = await supabase.rpc("confirm_inbound_receipt", {
    p_supplier_id: input.supplier_id, p_arrival_date: input.arrival_date, p_note: input.note ?? null, p_lines: lines,
  });
  if (error?.code === "23505" && error.message.includes("lot_no")) {
    throw new ApiError(409, "Số lô đã tồn tại cho sản phẩm này — kiểm tra lại số lô.");
  }
  assertNoDbError(error, "Lưu phiếu nhập");
  return { id: data };
});
