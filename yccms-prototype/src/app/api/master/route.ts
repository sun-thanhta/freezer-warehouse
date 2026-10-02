import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";

// Master data for forms (suppliers, products with zone thresholds, locations).
export const GET = withAuth(async (_req, { supabase }) => {
  const [suppliers, products, locations, zones] = await Promise.all([
    supabase.from("suppliers").select("id, code, name").order("code"),
    supabase.from("products")
      .select("id, sku, name, unit, zone_id, expiry_type, trace_lane")
      .order("sku"),
    supabase.from("locations").select("id, code, zone_id, is_quarantine").order("code"),
    supabase.from("temperature_zones").select("id, code, name, min_c, max_c").order("id"),
  ]);
  for (const r of [suppliers, products, locations, zones]) assertNoDbError(r.error, "Đọc danh mục");
  return { suppliers: suppliers.data, products: products.data, locations: locations.data, zones: zones.data };
});
