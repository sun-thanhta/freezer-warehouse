import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/supabase-server-client";
import { DB_UNREACHABLE_MESSAGE, isConnectivityError } from "@/lib/supabase/supabase-connectivity";
import { mapRpcError } from "./rpc-error-messages";

export type Role = "warehouse" | "manager";

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
  profile: { email: string; full_name: string; role: Role };
}

/** Business-rule failure the client should show as-is (HTTP 4xx). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Throws ApiError for a Supabase/PostgREST error. Raw DB text is logged, never sent to the client. */
export function assertNoDbError(error: { message: string; code?: string } | null, context: string): void {
  if (!error) return;
  if (isConnectivityError(error)) throw new ApiError(503, DB_UNREACHABLE_MESSAGE);
  const mapped = mapRpcError(error.message);
  if (mapped) throw new ApiError(mapped.status, mapped.message);
  if (error.code === "22P02") throw new ApiError(400, "Tham số không hợp lệ.");
  console.error(`[api] ${context}:`, error.code, error.message);
  throw new ApiError(500, `${context} thất bại. Vui lòng thử lại.`);
}

/** Validates a numeric `[id]` path param. */
export function intParam(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, "Không tìm thấy dữ liệu");
  return n;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Validates a uuid `[id]` path param. */
export function uuidParam(value: string): string {
  if (!UUID_RE.test(value)) throw new ApiError(404, "Không tìm thấy dữ liệu");
  return value;
}

/** Wraps a route handler: requires a signed-in user, maps errors to JSON responses. */
export function withAuth<C>(handler: (req: Request, auth: AuthContext, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C): Promise<NextResponse> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (isConnectivityError(error)) throw new ApiError(503, DB_UNREACHABLE_MESSAGE);
      if (!data.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("email, full_name, role").eq("id", data.user.id).maybeSingle();
      assertNoDbError(profileError, "Đọc hồ sơ người dùng");
      if (!profile) throw new ApiError(403, "Tài khoản chưa được cấp quyền (thiếu bản ghi profiles).");

      const body = await handler(req, { supabase, user: data.user, profile: profile as AuthContext["profile"] }, ctx);
      return NextResponse.json(body ?? { ok: true });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : String(err);
      const unreachable = isConnectivityError({ message });
      console.error("[api]", message);
      return NextResponse.json(
        { error: unreachable ? DB_UNREACHABLE_MESSAGE : "Lỗi máy chủ. Vui lòng thử lại." },
        { status: unreachable ? 503 : 500 },
      );
    }
  };
}

/** Writes an audit trail row (who / when / what) — used for config changes. */
export async function writeAudit(
  auth: AuthContext, action: string, entity: string, entityId: string, detail: Record<string, unknown>,
): Promise<void> {
  const { error } = await auth.supabase.from("audit_logs").insert({
    actor_id: auth.user.id, actor_email: auth.profile.email, action, entity, entity_id: entityId, detail,
  });
  assertNoDbError(error, "Ghi audit log");
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Body JSON không hợp lệ");
  }
}
