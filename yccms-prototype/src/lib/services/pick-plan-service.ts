// Builds outbound pick plans: FR-OUT-02 exclusion chain (消費期限 → band → 隔離 → window → 日付逆転)
// then FEFO/FIFO, per customer × SKU agreement. Batched so the alert screen can evaluate all open orders.

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNoDbError } from "@/lib/api/api-route-helpers";
import { evaluateLot, sortFefo, suggestAllocation, type ChainContext } from "@/lib/rules/allocation-chain-rules";
import { todayJst } from "@/lib/rules/date-utils";
import { checkDeliveryWindow } from "@/lib/rules/delivery-window-rules";
import type { TempRange } from "@/lib/rules/temperature-rules";
import type { LastDelivery, LineStatus, PendingOverride, PendingOverrideItem, PickPlan, PlanAgreement, PlanCustomer, PlanLine, PlanLot, PlanProduct } from "./pick-plan-types";

interface OrderRow {
  id: string; code: string; ship_date: string; status: "open" | "shipped"; ship_temp_c: number | null; shipped_at: string | null;
  customer: PlanCustomer; lines: { id: string; qty: number; product: PlanProduct }[];
}
interface LotRow extends Omit<PlanLot, "location" | "location_zone_id" | "exclusions" | "window"> {
  product_id: number; location: { code: string; zone_id: number } | null;
}
interface AgreementRow extends PlanAgreement { customer_id: number; product_id: number }
interface LastRow extends LastDelivery { customer_id: number; product_id: number }
interface PendingRow extends Omit<PendingOverride, "items"> { order_id: string; allocations: { order_line_id: string; lot_id: string; qty: number }[] }

const ORDER_SELECT = `id, code, ship_date, status, ship_temp_c, shipped_at, customer:customers(id, code, name),
  lines:outbound_lines(id, qty, product:products(id, sku, name, unit, zone_id, expiry_type, trace_lane, zone:temperature_zones(name, min_c, max_c)))`;

export async function buildPickPlans(supabase: SupabaseClient, filter: { orderId?: string; openOnly?: boolean }): Promise<PickPlan[]> {
  let query = supabase.from("outbound_orders").select(ORDER_SELECT).order("ship_date").order("code");
  if (filter.orderId) query = query.eq("id", filter.orderId);
  if (filter.openOnly) query = query.eq("status", "open");
  const { data, error } = await query;
  assertNoDbError(error, "Đọc đơn xuất");
  const orders = (data ?? []) as unknown as OrderRow[];
  if (orders.length === 0) return [];

  const productIds = [...new Set(orders.flatMap((o) => o.lines.map((l) => l.product.id)))];
  const customerIds = [...new Set(orders.map((o) => o.customer.id))];
  const [lotsRes, lastRes, agrRes, reqRes] = await Promise.all([
    supabase.from("lots").select("id, product_id, lot_no, mfg_date, expiry_date, received_at, qty_on_hand, status, trace_code, location:locations(code, zone_id)")
      .in("product_id", productIds).gt("qty_on_hand", 0),
    supabase.rpc("last_deliveries", { p_customer_ids: customerIds, p_product_ids: productIds }),
    supabase.from("customer_sku_agreements").select("customer_id, product_id, code, delivery_term, window_rule").in("customer_id", customerIds),
    supabase.from("override_requests").select("id, order_id, reason, requested_email, created_at, ship_temp_c, allocations")
      .in("order_id", orders.map((o) => o.id)).eq("status", "pending"),
  ]);
  for (const r of [lotsRes, lastRes, agrRes, reqRes]) assertNoDbError(r.error, "Đọc dữ liệu kế hoạch lấy hàng");
  const lots = (lotsRes.data ?? []) as unknown as LotRow[];
  const key = (c: number, p: number) => `${c}:${p}`;
  const last = new Map(((lastRes.data ?? []) as LastRow[]).map((h) => [key(h.customer_id, h.product_id), h]));
  const agreements = new Map(((agrRes.data ?? []) as AgreementRow[]).map((a) => [key(a.customer_id, a.product_id), a]));
  const pending = (reqRes.data ?? []) as PendingRow[];
  const today = todayJst();

  return orders.map((order) => {
    // A late shipment is judged on today's date, never on a stale planned ship date
    const refDate = order.ship_date > today ? order.ship_date : today;
    const plans = order.lines.map((line) => {
      const k = key(order.customer.id, line.product.id);
      const lastDelivery = last.get(k) ?? null;
      const agr = agreements.get(k);
      const agreement = agr ? { code: agr.code, delivery_term: agr.delivery_term, window_rule: agr.window_rule } : null;
      const ctx: ChainContext = {
        expiryType: line.product.expiry_type, productZoneId: line.product.zone_id, windowRule: agreement?.window_rule ?? null,
        lastDeliveredExpiry: lastDelivery?.expiry_date ?? null, shipDate: refDate,
      };
      const planLots: PlanLot[] = sortFefo(lots.filter((l) => l.product_id === line.product.id)).map(({ location, ...l }) => {
        const chainLot = { ...l, location_zone_id: location?.zone_id ?? null };
        return { ...chainLot, location: location?.code ?? null, exclusions: evaluateLot(chainLot, ctx), window: checkDeliveryWindow(l, ctx.windowRule, refDate) };
      });
      const suggestion = suggestAllocation(planLots, line.qty, ctx);
      const reversalOnlyQty = planLots.filter((l) => l.exclusions.length === 1 && l.exclusions[0] === "date_reversal")
        .reduce((s, l) => s + l.qty_on_hand, 0);
      let status: LineStatus = "ok";
      if (suggestion.shortfall > 0) status = reversalOnlyQty > 0 ? "date_reversal" : "insufficient";
      return { id: line.id, qty: line.qty, product: line.product, agreement, lastDelivery, lots: planLots, suggestion, status, reversalOnlyQty };
    });
    const req = pending.find((p) => p.order_id === order.id);
    return {
      order: { id: order.id, code: order.code, ship_date: order.ship_date, status: order.status, ship_temp_c: order.ship_temp_c, shipped_at: order.shipped_at },
      customer: order.customer,
      shipTempRange: coldestBandRange(order.lines.map((l) => l.product)),
      lines: plans,
      pendingOverride: req ? { ...req, items: describeAllocations(req.allocations, plans) } : null,
    };
  });
}

function describeAllocations(allocations: PendingRow["allocations"], lines: PlanLine[]): PendingOverrideItem[] {
  return allocations.map((a) => {
    const line = lines.find((l) => l.id === a.order_line_id);
    const lot = line?.lots.find((x) => x.id === a.lot_id);
    return { sku: line?.product.sku ?? "?", lot_no: lot?.lot_no ?? "(lô đã thay đổi)", qty: a.qty, expiry_date: lot?.expiry_date ?? "", isReversal: Boolean(lot?.exclusions.includes("date_reversal")) };
  });
}

/** Ship temperature is measured on the COLDEST band of the order (lowest upper bound). */
function coldestBandRange(products: PlanProduct[]): TempRange {
  const coldness = (p: PlanProduct) => p.zone.max_c ?? Number.POSITIVE_INFINITY;
  const coldest = products.reduce((a, b) => (coldness(b) < coldness(a) ? b : a));
  return { min: coldest.zone.min_c, max: coldest.zone.max_c };
}
