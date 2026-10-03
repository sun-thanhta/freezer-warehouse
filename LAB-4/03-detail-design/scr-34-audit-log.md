# SCR-34 — Audit log (append-only)

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Mục đích | Trả lời "ai, khi nào, đã thay đổi gì" cho mọi thao tác ghi nghiệp vụ và cấu hình |
| URL | `/audit` |
| Vai trò | Prototype: mọi vai trò · Đích: `manager`, `qa`, `admin`, `auditor` |
| API | `GET /api/audit?action={prefix}` |
| Wireframe | [WF-13](../02-wireframes/wireframe-04-master-trace-audit.md#wf-13--audit-log-scr-34) |
| Yêu cầu | NFR-AUD-01, SCR-34, IF-ARCH-01 (đích) |

## 2. Bảng phần tử

| No. | Tên | Kiểu | Quy tắc |
|---|---|---|---|
| 1 | Tiêu đề | label | — |
| 2 | Lọc theo hành động | radio-tab | `Tất cả` · `inbound` · `outbound` · `override` · `quarantine` · `customer_sku_agreements` · `temperature_zones` · `products` · `seed`. Lọc **tiền tố** của `action` (`like 'prefix%'`) |
| 3a | Thời điểm | datetime | `audit_logs.created_at` (mới nhất trước) |
| 3b | Người thực hiện | label | `actor_email` (đóng dấu từ JWT bởi trigger `stamp_actor`; "—" nếu NULL; `system` cho seed) |
| 3c | Hành động | code | `action` |
| 3d | Đối tượng | label | `entity` + 8 ký tự đầu `entity_id` |
| 3e | Chi tiết | pre (JSON) | `detail`; cuộn ngang trong ô |

Tối đa 200 dòng mới nhất. Rỗng: "Không có bản ghi."

## 3. Danh mục `action`

| action | entity | Ai ghi | `detail` |
|---|---|---|---|
| `inbound.confirm` | `inbound_receipts` | `confirm_inbound_receipt` | `code`, `lines` (số dòng) |
| `outbound.ship` | `outbound_orders` | `_perform_shipment` | `code`, `allocations`, `ship_temp_c`, `date_reversal_overrides`, `override_reason`, `approver` |
| `override.request` | `override_requests` | `request_override` | `order`, `reason` |
| `override.approve` / `override.reject` | `override_requests` | `decide_override` | `order_id`, `note` |
| `quarantine.release` / `quarantine.scrap` | `lots` | `resolve_quarantine` | `lot_no`, `qty`, `location`, `reason` |
| `temperature_zones.update` / `products.update` / `customer_sku_agreements.update` | tên bảng | trigger `audit_config_change` | `before`, `after` (bỏ `updated_at`) |
| `seed.load` | `database` | script seed | ghi chú, ngày seed |

## 4. Validation, sự kiện, trạng thái

| Mục | Nội dung |
|---|---|
| Validation | Không có ô nhập. `action` lạ (không khớp tiền tố nào) → danh sách rỗng, không lỗi |
| Sự kiện | Mở trang → `GET /api/audit`; bấm một nút lọc [2] → `GET /api/audit?action={prefix}` (nút "Tất cả" bỏ tham số) |
| Trạng thái màn | `loading` → `ready` / `empty` ("Không có bản ghi.") / `error` (hộp lỗi + Thử lại) |
| Trạng thái nghiệp vụ | Không có: bản ghi audit bất biến |

## 5. Bảo đảm toàn vẹn

| Bảo đảm | Cơ chế |
|---|---|
| Không sửa / xóa | Thu hồi `UPDATE`, `DELETE`, `TRUNCATE` của `authenticated`; không có policy update/delete |
| Không giả mạo người thực hiện | Trigger `stamp_actor` ghi đè `actor_id`, `actor_email` theo `auth.uid()` |
| **Chưa bảo đảm ở prototype:** nội dung dòng audit | Policy `audit_insert` cho mọi người có profile chèn dòng với `action`/`entity`/`detail` tùy ý (chỉ người thực hiện là đúng). Ứng dụng không dùng đường này. Bản đích thu hồi quyền INSERT của `authenticated`; chỉ hàm SQL và trigger được ghi |
| Không thể "quên" ghi audit cấu hình | Trigger DB, không phụ thuộc code API |
| Ghi audit cùng giao dịch với thao tác | Các hàm SQL insert `audit_logs` trong cùng giao dịch: thao tác rollback thì audit cũng rollback, không có audit "ma" |

## 6. Phân quyền

| Thao tác | warehouse | manager | Thực thi |
|---|---|---|---|
| Xem | ✓ (đích: —) | ✓ | RLS đọc |
| Ghi trực tiếp | Chỉ dòng có `actor_id = auth.uid()` (policy `audit_insert`) | như warehouse | Ứng dụng không dùng đường này; là khe hở cần đóng ở bản đích |

## 7. [Prototype khác]

| Prototype | Hệ thống đích | Lý do |
|---|---|---|
| `authenticated` chèn được dòng audit tùy ý (policy `audit_insert`) | Thu hồi INSERT; chỉ hàm `SECURITY DEFINER`/trigger ghi | Nội dung audit không thể bị giả |
| Role owner/service vẫn sửa được bảng | Trigger `BEFORE UPDATE OR DELETE` raise exception cho mọi role; chỉ xóa theo chính sách lưu trữ bằng job có kiểm soát | NFR-AUD-01 nghiêm ngặt |
| Không log đăng nhập, xuất file | Thêm `auth.*`, `export.*` | NFR-AUD-01 |
| 200 dòng, lọc theo tiền tố | Lọc theo người, khoảng ngày, đối tượng; phân trang; partition theo tháng | Quy mô 3 năm (DR-RET-01) |
| Không xuất bằng chứng | Xuất CSV/PDF + manifest SHA-256 (SCR-31, IF-ARCH-01) | Kiểm toán |
| Ai có profile cũng xem được | Giới hạn theo vai trò | Tối thiểu quyền |
