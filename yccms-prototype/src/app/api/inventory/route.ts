import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";
import { daysBetween, todayJst } from "@/lib/rules/date-utils";

interface LotRow {
  expiry_date: string; status: string;
  product: { near_expiry_days: number; zone_id: number } | null;
  [key: string]: unknown;
}

// Stock by SKU / lot / location / band (FR-INV-06), near-expiry per expiry type, 隔離 view (FR-INV-05).
export const GET = withAuth(async (req, { supabase }) => {
  const params = new URL(req.url).searchParams;
  const view = params.get("view") ?? "all";
  const zone = Number(params.get("zone") ?? 0);

  const { data, error } = await supabase.from("lots")
    .select(`id, lot_no, mfg_date, expiry_date, qty_received, qty_on_hand, status, trace_code, received_at,
      location:locations(code, zone_id, is_quarantine), supplier:suppliers(code, name),
      product:products(sku, name, unit, expiry_type, trace_lane, near_expiry_days, zone_id, zone:temperature_zones(name))`)
    .gt("qty_on_hand", 0).order("expiry_date");
  assertNoDbError(error, "Đọc tồn kho");

  const today = todayJst();
  const lots = ((data ?? []) as unknown as LotRow[]).map((lot) => {
    const daysLeft = daysBetween(today, lot.expiry_date);
    const expiry = daysLeft < 0 ? "expired" : daysLeft <= (lot.product?.near_expiry_days ?? 0) ? "near" : "ok";
    return { ...lot, daysLeft, expiry };
  }).filter((lot) => (zone ? lot.product?.zone_id === zone : true))
    .filter((lot) => (view === "near" ? lot.expiry !== "ok" : view === "quarantine" ? lot.status === "quarantine" : true));
  return { today, lots };
});
