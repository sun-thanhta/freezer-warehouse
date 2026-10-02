// Detects "Supabase unreachable" (network down, project paused) vs ordinary errors.

export const DB_UNREACHABLE_MESSAGE =
  "Không kết nối được database Supabase. Nếu project đang tạm dừng (paused), vào Supabase Dashboard và bấm \"Resume project\", đợi 1–2 phút rồi tải lại trang.";

export function isConnectivityError(error: { message?: string; name?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|network|Failed to fetch/i.test(error.message ?? "");
}
