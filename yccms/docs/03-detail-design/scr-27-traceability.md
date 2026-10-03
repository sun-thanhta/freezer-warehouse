# SCR-27 — Truy xuất nguồn gốc (xuôi / ngược)

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Mục đích | **Truy xuôi:** từ một số lô ra mọi khách đã nhận lô đó (dùng khi recall). **Truy ngược:** từ một khách ra các lô đã nhận, nhà cung cấp, phiếu nhập |
| URL | `/trace` |
| Vai trò | Mọi vai trò (chỉ đọc) |
| API | `GET /api/trace?lot={lot_no}` · `GET /api/trace?customer={id}` · `GET /api/customers` (danh sách chọn) |
| Wireframe | [WF-12](../02-wireframes/wireframe-04-master-trace-audit.md#wf-12--truy-xuất-nguồn-gốc-scr-27) |
| Yêu cầu | FR-TRC-01, BR-TRACE-01/02/03, DR-TRACE-01, NFR-PERF-02 |

## 2. Bảng phần tử

| No. | Tên | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|---|
| 1 | Tiêu đề | label | — | Nêu 3 lane: 米 và 牛 là pháp định, còn lại nội bộ |
| 2 | Số lô | text | ✓ để truy xuôi | Trim; so khớp **không phân biệt hoa thường**, toàn chuỗi (ký tự `%`, `_`, `\` được thoát, không thành ký tự đại diện) |
| 3 | Truy xuôi | button submit | — | Bỏ qua nếu [2] rỗng |
| 4 | Khách hàng | select | — | `code · name`; chọn là tra ngay (truy ngược) |
| 5 | Trạng thái | label / alert | — | "Đang truy vết…" · hộp lỗi |
| 6 | Thẻ thông tin lô | card | — | Chỉ ở truy xuôi |
| 6a | Nhà cung cấp | label | — | `suppliers.name` |
| 6b | Phiếu nhập · nhiệt lúc nhận | link | — | `inbound_receipts.code` → `/inbound/{id}` · `inbound_lines.temp_c` ("—" nếu lô không có phiếu, ví dụ lô migration) |
| 6c | NSX → hạn | label | — | `mfg_date → expiry_date` |
| 6d | Mã truy xuất + lane | label + badge | — | `trace_code`; badge lane |
| 6e | Đã nhập / còn tồn | number | — | `qty_received / qty_on_hand` |
| 7 | Bảng giao hàng | table | — | Tiêu đề: "Các khách đã nhận lô này" / "Các lô khách đã nhận" |
| 7a | Ngày giao | datetime | — | `delivery_history.delivered_at` (xuôi: cũ → mới; ngược: mới → cũ) |
| 7b | Khách | label | — | `customers.name` |
| 7c | Đơn | link | — | `outbound_orders.code` → `/outbound/{id}` |
| 7d | SKU | label + badge | — | `sku`; `牛` / `米` nếu lane pháp định |
| 7e | Lô / mã truy xuất | label | — | `lot_no`, `trace_code` |
| 7f | NCC ← phiếu nhập | label | — | `suppliers.name`; `receipt.code (arrival_date)` |
| 7g | SL | number | — | `qty` |

Rỗng: "Chưa có giao hàng liên quan."

## 3. Validation / lỗi

| # | Tình huống | HTTP | Thông báo |
|---|---|---|---|
| V1 | Không truyền `lot` lẫn `customer` | 400 | "Nhập số lô (truy xuôi) hoặc chọn khách hàng (truy ngược)" |
| V2 | Không tìm thấy lô | 404 | "Không tìm thấy lô "{lot}"" |
| V3 | Số lô trùng ở nhiều SKU (vì `lots` chỉ duy nhất theo `(product_id, lot_no)`) | 409 | "Số lô "{lot}" có ở nhiều SKU — liên hệ quản lý để tra theo SKU." |

## 4. Sự kiện

| Sự kiện | Xử lý |
|---|---|
| Bấm [3] | `GET /api/trace?lot=…` → `{mode:'forward', lot, deliveries[]}` |
| Đổi [4] | `GET /api/trace?customer=…` → `{mode:'backward', deliveries[]}` |

## 5. Trạng thái

| Trạng thái | Khi nào | Hiển thị |
|---|---|---|
| `idle` | Mới mở, chưa tra | Chỉ có 2 khung tra cứu |
| `loading` | Đang gọi API | "Đang truy vết…" |
| `forward` | Truy xuôi thành công | Thẻ lô [6] + bảng [7] "Các khách đã nhận lô này" |
| `backward` | Truy ngược thành công | Bảng [7] "Các lô khách đã nhận" (không có [6]) |
| `empty` | Thành công nhưng chưa có lần giao | Bảng [7] hiện "Chưa có giao hàng liên quan." |
| `error` | 400 / 404 / 409 | Hộp lỗi (không có nút Thử lại) |

Không có trạng thái nghiệp vụ: màn chỉ đọc.

## 6. Phân quyền

Mọi vai trò có `profiles` đều xem được. Không có thao tác ghi.

## 7. [Prototype khác]

| Prototype | Hệ thống đích | Lý do |
|---|---|---|
| Truy xuôi theo số lô (không chọn SKU); trùng số lô → 409 | Ô SKU (tùy chọn) + số lô; tìm theo mã truy xuất (mã cá thể bò, 産地) | DR-TRACE-01 typed & searchable |
| `trace_code` 1 chuỗi | `lot_regulated_ids` có kiểu; index theo `(id_type, value)` | Tìm "mọi lô của con bò 1408123456" |
| Không chỉ ra điểm đứt liên kết | Báo các lô không có phiếu nhập / giao không có đơn ("liên kết bị đứt") | FE-33 |
| Không phân trang, truy vấn trực tiếp | Phân trang + index `delivery_history(lot_id)` (đã có), `(customer_id, delivered_at)`; mục tiêu 3 năm dữ liệu ≤ 60s | NFR-PERF-02 |
| Không có recall | Nút "Tạo recall case" từ kết quả truy xuôi (SCR-28) | Module recall |
