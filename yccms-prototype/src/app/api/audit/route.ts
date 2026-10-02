import { assertNoDbError, withAuth } from "@/lib/api/api-route-helpers";

export const GET = withAuth(async (req, { supabase }) => {
  const action = new URL(req.url).searchParams.get("action");
  let query = supabase.from("audit_logs").select("id, actor_email, action, entity, entity_id, detail, created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (action) query = query.like("action", `${action}%`);
  const { data, error } = await query;
  assertNoDbError(error, "Đọc audit log");
  return { logs: data };
});
