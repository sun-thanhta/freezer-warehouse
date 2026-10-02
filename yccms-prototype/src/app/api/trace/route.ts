import { ApiError, assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";

const DELIVERY_SELECT = `id, qty, expiry_date, delivered_at, order:outbound_orders(id, code),
  customer:customers(id, code, name),
  lot:lots!inner(id, lot_no, mfg_date, expiry_date, trace_code, received_at, supplier:suppliers(code, name),
    inbound:inbound_lines(temp_c, receipt:inbound_receipts(id, code, arrival_date))),
  product:products(sku, name, trace_lane)`;

// Forward: lot → customers that received it. Backward: customer → lots → supplier / inbound receipt.
export const GET = withAuth(async (req, { supabase }) => {
  const params = new URL(req.url).searchParams;
  const lotNo = params.get("lot")?.trim();
  const customerId = params.get("customer");

  if (lotNo) {
    const { data: lots, error } = await supabase.from("lots")
      .select(`id, lot_no, mfg_date, expiry_date, qty_received, qty_on_hand, trace_code, received_at,
        supplier:suppliers(code, name), product:products(sku, name, trace_lane),
        inbound:inbound_lines(temp_c, temp_ok, receipt:inbound_receipts(id, code, arrival_date))`)
      .ilike("lot_no", lotNo.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(2);
    assertNoDbError(error, "Tra cứu lô");
    if (!lots?.length) throw new ApiError(404, `Không tìm thấy lô "${lotNo}"`);
    if (lots.length > 1) throw new ApiError(409, `Số lô "${lotNo}" có ở nhiều SKU — liên hệ quản lý để tra theo SKU.`);
    const lot = lots[0];
    const { data: deliveries, error: dErr } = await supabase.from("delivery_history").select(DELIVERY_SELECT)
      .eq("lot_id", lot.id).order("delivered_at");
    assertNoDbError(dErr, "Tra cứu giao hàng");
    return { mode: "forward", lot, deliveries };
  }

  if (customerId) {
    const { data: deliveries, error } = await supabase.from("delivery_history").select(DELIVERY_SELECT)
      .eq("customer_id", customerId).order("delivered_at", { ascending: false });
    assertNoDbError(error, "Tra cứu giao hàng");
    return { mode: "backward", deliveries };
  }
  throw new ApiError(400, "Nhập số lô (truy xuôi) hoặc chọn khách hàng (truy ngược)");
});
