// Maps the exception codes raised by the SQL RPCs (supabase/migrations/0003–0004)
// to user-facing Vietnamese messages + HTTP status. Unknown codes fall through to a generic 500.

const RPC_ERRORS: Record<string, { status: number; message: string }> = {
  NO_PROFILE: { status: 403, message: "Tài khoản chưa được cấp quyền (thiếu hồ sơ người dùng)." },
  FORBIDDEN: { status: 403, message: "Chỉ quản lý được thực hiện thao tác này." },
  // outbound — FR-OUT-02 chain
  USE_BY_EXPIRED: { status: 422, message: "消費期限 đã đến/quá — HARD STOP, không được giao." },
  ZONE_MISMATCH: { status: 422, message: "Lô đang nằm sai dải nhiệt — không được giao." },
  LOT_QUARANTINED: { status: 422, message: "Lô đang 隔離 — chờ QA release." },
  DATE_REVERSAL: { status: 409, message: "CHẶN: vi phạm 日付逆転禁止 (kiểm tra cuối ở database)." },
  SHIP_TEMP_OUT_OF_RANGE: { status: 422, message: "Nhiệt độ khi xuất ngoài ngưỡng — xử lý chuỗi lạnh trước khi giao." },
  INSUFFICIENT_STOCK: { status: 409, message: "Tồn kho đã thay đổi, không đủ số lượng — tải lại trang." },
  ORDER_NOT_OPEN: { status: 409, message: "Đơn đã được giao hoặc đóng — tải lại trang." },
  ORDER_NOT_FOUND: { status: 404, message: "Không tìm thấy đơn xuất." },
  ALLOCATION_MISMATCH: { status: 422, message: "Phải phân bổ đủ số lượng cho từng dòng đơn." },
  LINE_NOT_IN_ORDER: { status: 422, message: "Có dòng phân bổ không thuộc đơn này." },
  LOT_PRODUCT_MISMATCH: { status: 422, message: "Lô không đúng sản phẩm của dòng đơn." },
  INVALID_QTY: { status: 422, message: "Số lượng phân bổ phải lớn hơn 0." },
  // maker-checker
  NO_REVERSAL: { status: 422, message: "Phân bổ này không vi phạm 日付逆転 — không cần đề nghị ngoại lệ." },
  REQUEST_NOT_PENDING: { status: 409, message: "Đề nghị đã được xử lý." },
  SELF_APPROVAL: { status: 403, message: "Người lập đề nghị không được tự duyệt (maker-checker) — cần quản lý khác." },
  REASON_REQUIRED: { status: 422, message: "Bắt buộc nhập lý do." },
  NOT_A_VIOLATION: { status: 422, message: "Không phải vi phạm thật — không ghi nhật ký." },
  // inbound / quarantine
  INVALID_ARRIVAL_DATE: { status: 422, message: "Ngày nhận chỉ được trong 7 ngày gần nhất và không ở tương lai." },
  NO_LINES: { status: 422, message: "Phiếu nhập phải có ít nhất 1 dòng." },
  INVALID_SUPPLIER: { status: 422, message: "Nhà cung cấp không hợp lệ." },
  INVALID_PRODUCT: { status: 422, message: "Sản phẩm không hợp lệ." },
  INVALID_RESULT: { status: 422, message: "Kết quả kiểm không hợp lệ." },
  TEMP_REQUIRED: { status: 422, message: "Bắt buộc nhập nhiệt độ khi nhận." },
  TEMP_DEVIATION: { status: 422, message: "Nhiệt độ ngoài ngưỡng — chỉ được Từ chối hoặc 保留 (隔離), kèm ghi chú." },
  EXPIRED_ON_ARRIVAL: { status: 422, message: "消費期限 đã đến/quá ngay khi nhận — không được nhập kho." },
  RICE_TRACE_REQUIRED: { status: 422, message: "Gạo (米トレーサビリティ法): bắt buộc 産地・取引." },
  BEEF_ID_REVIEW: { status: 422, message: "Mã cá thể bò chỉ có 9 số → business-review, không tự làm tròn." },
  BEEF_ID_INVALID: { status: 422, message: "Mã cá thể bò phải đúng 10 chữ số." },
  INVALID_LOCATION: { status: 422, message: "Vị trí không hợp lệ (sai dải nhiệt hoặc sai loại vị trí 隔離/thường)." },
  LOT_NOT_QUARANTINED: { status: 409, message: "Lô không còn ở trạng thái 隔離." },
  INVALID_ACTION: { status: 422, message: "Thao tác không hợp lệ." },
};

/** Returns {status, message} for a known RPC exception (format `CODE` or `CODE:detail`), else null. */
export function mapRpcError(message: string | undefined): { status: number; message: string } | null {
  if (!message) return null;
  const [code, detail] = message.split(":");
  const known = RPC_ERRORS[code.trim()];
  if (!known) return null;
  return { status: known.status, message: detail ? `${known.message} (${detail.trim()})` : known.message };
}
