import { assertNoDbError, readJsonBody, uuidParam, withAuth } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };

// SCR-10 隔離 → release (to a normal location of the same band) / scrap. Manager only, reason required, audited.
export const POST = withAuth<Ctx>(async (req, { supabase }, ctx) => {
  const id = uuidParam((await ctx.params).id);
  const body = await readJsonBody<{ action: string; location_id?: number | null; reason: string }>(req);
  const { error } = await supabase.rpc("resolve_quarantine", {
    p_lot_id: id, p_action: body.action, p_location_id: body.location_id ? Number(body.location_id) : null, p_reason: body.reason ?? "",
  });
  assertNoDbError(error, "Xử lý 隔離");
  return { ok: true };
});
