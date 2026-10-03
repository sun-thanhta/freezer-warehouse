import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/supabase-server-client";
import { DB_UNREACHABLE_MESSAGE, isConnectivityError } from "@/lib/supabase/supabase-connectivity";
import { mapRpcError } from "./rpc-error-messages";

export type Role = "warehouse" | "manager" | "qa" | "sales" | "admin" | "auditor" | "driver" | "dispatcher";

export interface AuthContext {
  supabase: SupabaseClient;
  user: User;
  profile: { email: string; full_name: string; roles: Role[] };
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

/** Throws 403 unless the caller holds at least one of the roles. */
export function requireRole(auth: AuthContext, ...roles: Role[]): void {
  if (!roles.some((r) => auth.profile.roles.includes(r))) throw new ApiError(403, "Bạn không có quyền thực hiện thao tác này.");
}

/** Wraps a route handler: requires a signed-in, provisioned (active + ≥1 role) user; maps errors to JSON. */
export function withAuth<C>(handler: (req: Request, auth: AuthContext, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C): Promise<NextResponse> => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser();
      if (isConnectivityError(error)) throw new ApiError(503, DB_UNREACHABLE_MESSAGE);
      if (!data.user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("app_users").select("email, full_name, is_active").eq("id", data.user.id).maybeSingle(),
        supabase.rpc("current_user_roles"),
      ]);
      assertNoDbError(profileRes.error, "Đọc hồ sơ người dùng");
      assertNoDbError(rolesRes.error, "Đọc vai trò người dùng");
      const roles = (rolesRes.data ?? []) as Role[];
      if (!profileRes.data?.is_active || roles.length === 0) {
        throw new ApiError(403, "Tài khoản chưa được cấp quyền (thiếu hồ sơ, bị khóa hoặc chưa có vai trò).");
      }

      const profile = { email: profileRes.data.email, full_name: profileRes.data.full_name, roles };
      const body = await handler(req, { supabase, user: data.user, profile }, ctx);
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

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Body JSON không hợp lệ");
  }
}
