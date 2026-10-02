import { assertNoDbError, readJsonBody, uuidParam, withAuth } from "@/lib/api/api-route-helpers";

type Ctx = { params: Promise<{ id: string }> };

// SCR-05 maker-checker: a manager other than the requester approves (→ ships) or rejects (note required).
export const POST = withAuth<Ctx>(async (req, { supabase }, ctx) => {
  const id = uuidParam((await ctx.params).id);
  const body = await readJsonBody<{ approve: boolean; note?: string }>(req);
  const { error } = await supabase.rpc("decide_override", { p_request_id: id, p_approve: body.approve === true, p_note: body.note ?? "" });
  assertNoDbError(error, "Duyệt đề nghị ngoại lệ");
  return { ok: true };
});
