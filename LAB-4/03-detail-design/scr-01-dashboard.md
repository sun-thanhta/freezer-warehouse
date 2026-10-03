# SCR-01 — Tổng quan vận hành

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Mục đích | Mở ca là thấy ngay việc cần xử lý: đơn bị chặn, đề nghị chờ duyệt, lô 隔離 / 消費期限, hợp đồng chưa chốt |
| URL | `/` |
| Vai trò | Mọi vai trò có `profiles` (chỉ đọc) |
| API | `GET /api/dashboard` |
| Wireframe | [WF-01](../02-wireframes/wireframe-01-layout-login-dashboard.md#wf-01--tổng-quan-vận-hành-scr-01) |
| Yêu cầu | SCR-01 (F09), US-02, FR-OUT-02, FR-INV-05 |

## 2. Bảng phần tử

| No. | Tên | Kiểu | Nguồn dữ liệu / cách tính | Liên kết |
|---|---|---|---|---|
| 1 | Tiêu đề + ngày làm việc | label | `today` = `todayJst()` | — |
| 2 | + Phiếu nhập | button-link | — | `/inbound/new` |
| 3 | Xuất kho | button-link | — | `/outbound` |
| 4a | Đơn xuất đang mở | card | `openOrders` = số đơn `status='open'` (từ pick-plan); gợi ý: `excludedLots` = tổng lô bị loại (bước đầu tiên vi phạm) trên mọi dòng đơn mở | `/outbound` |
| 4b | Dòng bị chặn 日付逆転 | card đỏ | `reversalBlocked` = số dòng đơn mở có `status='date_reversal'` (thiếu lô hợp lệ và còn lô chỉ vướng ⑤) | `/alerts` |
| 4c | Chờ duyệt ngoại lệ | card tím | `pendingApprovals` = `count(override_requests where status='pending')` | `/alerts` |
| 4d | Hợp đồng chưa chốt window | card cam | `reviewAgreements` = `count(customer_sku_agreements where window_rule is null)` | `/customers` |
| 4e | Lô đang 隔離 | card tím | `quarantineLots` = lô `qty_on_hand>0` và `status='quarantine'` | `/inventory?view=quarantine` |
| 4f | Lô 消費期限 đã đến | card đỏ | `useByExpiredLots` = lô còn tồn, SKU `use_by`, `expiry_date ≤ today` | `/inventory?view=near` |
| 4g | Lô cận hạn | card cam | `nearExpiryLots` = lô còn tồn có `0 ≤ (expiry − today) ≤ products.near_expiry_days` | `/inventory?view=near` |
| 4h | Nhiệt lệch khi nhận (7 ngày) | card xám | `tempFailures7d` = `count(inbound_lines where temp_ok=false and receipt.arrival_date ≥ today−7)`; gợi ý: `inboundToday` = số phiếu `arrival_date = today` | `/inbound` |
| 5a | Lượt bị chặn (7 ngày) | số đỏ | `allocation_exceptions` có `decision='blocked'` và `created_at ≥ today−7` | — |
| 5b | Ngoại lệ đã duyệt (7 ngày) | số tím | như trên, `decision='overridden'` | — |
| 5c | Chú thích luật | label | Cố định | — |
| 6 | Thao tác gần đây | list | 6 dòng `audit_logs` mới nhất: `action`, `actor_email`, `created_at` | "Xem audit log →" `/audit` |

## 3. Validation

Không có ô nhập.

## 4. Sự kiện

| Sự kiện | Xử lý |
|---|---|
| Mở trang | `GET /api/dashboard`. API chạy song song 7 truy vấn và `buildPickPlans({openOnly:true})` trong một `Promise.all` |
| Bấm thẻ KPI | Đi tới URL ở cột "Liên kết" |
| Lỗi API | Hộp lỗi + [Thử lại] (quy tắc chung) |

## 5. Trạng thái

Màn hình: `loading` → `ready` | `error`. Không có trạng thái nghiệp vụ riêng.

## 6. Phân quyền

| Thao tác | warehouse | manager |
|---|---|---|
| Xem | ✓ | ✓ |

## 7. Ghi chú thiết kế

- 4a, 4b dùng **chung engine** `buildPickPlans` với màn xuất kho và màn cảnh báo, nên số trên dashboard luôn khớp với số trong danh sách.
- 4g: phạm vi `daysLeft ≥ 0` nên lô đã quá hạn không bị đếm là "cận hạn". Lô quá hạn hiện ở view "Cận hạn & quá hạn" của SCR-08.

## 8. [Prototype khác]

| Prototype | Hệ thống đích |
|---|---|
| Tính KPI mỗi lần mở trang bằng truy vấn trực tiếp | Với dữ liệu thật (7.200 dòng xuất/tháng) chuyển phần đếm sang hàm SQL tổng hợp hoặc materialized view làm mới 5 phút, để giữ p95 ≤ 2s |
| Đọc lô qua API mặc định (giới hạn 1.000 dòng) | Đếm trong SQL (`count`), không kéo dòng về |
| Không có KPI nhiệt logger, POD, tuyến | Thêm thẻ khi module F06/F07 vào phạm vi |
