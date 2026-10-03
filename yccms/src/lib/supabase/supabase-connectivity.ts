// Detects "Supabase unreachable" (local stack not started, Docker/Colima stopped, network down) vs ordinary errors.

export const DB_UNREACHABLE_MESSAGE =
  "Không kết nối được Supabase local. Kiểm tra Docker (Colima) đang chạy rồi chạy `npm run db:start`, sau đó tải lại trang.";

export function isConnectivityError(error: { message?: string; name?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|network|Failed to fetch/i.test(error.message ?? "");
}
