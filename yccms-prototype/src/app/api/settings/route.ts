import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";

export const GET = withAuth(async (_req, { supabase }) => {
  const [zones, products] = await Promise.all([
    supabase.from("temperature_zones").select("id, code, name, min_c, max_c, updated_at").order("id"),
    supabase.from("products").select("id, sku, name, unit, zone_id, expiry_type, trace_lane, near_expiry_days").order("sku"),
  ]);
  assertNoDbError(zones.error, "Đọc dải nhiệt");
  assertNoDbError(products.error, "Đọc sản phẩm");
  return { zones: zones.data, products: products.data };
});
