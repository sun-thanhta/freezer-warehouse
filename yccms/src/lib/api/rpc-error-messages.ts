// Maps exception codes raised by SQL functions (`RAISE EXCEPTION 'CODE:detail'`) to user-facing messages + HTTP status.
// Full catalogue to grow with each module: docs/03-detail-design/business-rules-and-state-machines.md §6.

const RPC_ERRORS: Record<string, { status: number; message: string }> = {
  NO_PROFILE: { status: 403, message: "Tài khoản chưa được cấp quyền (thiếu hồ sơ người dùng)." },
  FORBIDDEN: { status: 403, message: "Bạn không có quyền thực hiện thao tác này." },
  REASON_REQUIRED: { status: 422, message: "Bắt buộc nhập lý do." },
};

/** Returns {status, message} for a known RPC exception (format `CODE` or `CODE:detail`), else null. */
export function mapRpcError(message: string | undefined): { status: number; message: string } | null {
  if (!message) return null;
  const [code, detail] = message.split(":");
  const known = RPC_ERRORS[code.trim()];
  if (!known) return null;
  return { status: known.status, message: detail ? `${known.message} (${detail.trim()})` : known.message };
}
