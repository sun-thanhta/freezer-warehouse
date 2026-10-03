# SCR-32 + SCR-02 — Ngưỡng nhiệt 3 dải · master SKU (loại hạn, ngưỡng cận hạn)

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Mục đích | Cấu hình mà **mọi** kiểm tra nhiệt (nhập, xuất) và quyết định hạn dùng (賞味 cảnh báo / 消費 hard stop) đọc từ đó. Không viết cứng trong mã nguồn |
| URL | `/settings` |
| Vai trò | Xem: mọi vai trò · Sửa: `manager` |
| API | `GET /api/settings` · `PATCH /api/settings/zones/[id]` · `PATCH /api/settings/products/[id]` · `GET /api/me` |
| Wireframe | [WF-11](../02-wireframes/wireframe-04-master-trace-audit.md#wf-11--ngưỡng-nhiệt--master-sku-scr-32--scr-02) |
| Yêu cầu | R-01, BR-TEMP-01, BR-EXP-01, R-02, NFR-AUD-01 |

## 2. Bảng phần tử

| No. | Tên | Kiểu | Bắt buộc | Định dạng / miền | Nguồn |
|---|---|---|---|---|---|
| 1 | Tiêu đề | label | — | — | — |
| 2 | Cảnh báo quyền | alert cam | — | Hiện khi không phải manager | `me.role` |
| 3 | Thông báo | alert | — | "Đã lưu ngưỡng {dải}: {range}" / "Đã lưu {SKU}: {loại hạn}, cảnh báo trước n ngày" / lỗi | — |
| 4 | Bảng ngưỡng 3 dải | table | — | 3 dòng theo `temperature_zones.id` | — |
| 5 | Min (°C) | number step 0.1 | ít nhất 1 trong 2 | Trống = không giới hạn dưới | `min_c` |
| 6 | Max (°C) | number step 0.1 | ít nhất 1 trong 2 | Trống = không giới hạn trên; min ≤ max | `max_c` |
| 7 | Lưu (dải) | button | — | Chỉ bật khi giá trị khác bản gốc | — |
| 8 | Bảng 12 SKU | table | — | Sắp theo `sku` | — |
| 8a | SKU | label | — | `sku`, `name` | `products` |
| 8b | Dải nhiệt | label | — | Tên dải + khoảng ngưỡng hiện hành | `temperature_zones` |
| 8c | Truy xuất | badge | — | `米 (産地・取引)` / `牛 (mã cá thể 10 số)` tím; `internal_lot` → chữ xám | `trace_lane` (chỉ đọc) |
| 9 | Loại hạn | select | ✓ | `best_before` "賞味期限" · `use_by` "消費期限" | `expiry_type` |
| 10 | Cận hạn (ngày) | number | ✓ | Số nguyên 0–365 | `near_expiry_days` |
| 11 | Lưu (SKU) | button | — | Chỉ bật khi đã sửa | — |

Với warehouse: [5][6][9][10] `disabled`, không có [7][11].
**Không sửa được** ở màn này: dải nhiệt của SKU, `trace_lane`, mã/tên dải. Các trường này là master cấu trúc; đổi chúng ảnh hưởng tồn kho và vị trí đang có.

## 3. Validation

| # | Quy tắc | Lớp | Thông báo / mã |
|---|---|---|---|
| V1 | Vai trò `manager` | BFF; RLS `manager_update`; GRANT UPDATE chỉ cột `min_c, max_c, updated_at` (dải) / `expiry_type, near_expiry_days, updated_at` (SKU) | 403 "Chỉ quản lý được đổi ngưỡng nhiệt." / "…cấu hình SKU." |
| V2 | min, max là số hoặc trống | BFF | 422 "Ngưỡng phải là số" |
| V3 | Ít nhất một ngưỡng | BFF | 422 "Cần ít nhất một ngưỡng (min hoặc max)" |
| V4 | min ≤ max khi có cả hai | BFF | 422 "Ngưỡng min phải ≤ max" |
| V5 | `expiry_type` ∈ {best_before, use_by} | BFF + CHECK | 422 "Loại hạn không hợp lệ" |
| V6 | `near_expiry_days` nguyên 0–365 | BFF | 422 "Ngưỡng cận hạn phải là số ngày 0–365" |
| V7 | Bản ghi tồn tại | BFF | 404 |

Ghi audit tự động bằng trigger `audit_config_change` (`temperature_zones.update`, `products.update`) với `before` / `after`, bất kể đi đường nào.

## 4. Sự kiện

| Sự kiện | Xử lý | Thành công | Thất bại |
|---|---|---|---|
| Bấm [7] | `PATCH /api/settings/zones/{id} {min_c, max_c}` (chuỗi rỗng → NULL) | [3] xanh, tải lại | [3] đỏ |
| Bấm [11] | `PATCH /api/settings/products/{id} {expiry_type, near_expiry_days}` | [3] xanh, tải lại | [3] đỏ |

## 5. Ảnh hưởng khi thay đổi

| Thay đổi | Ảnh hưởng ngay | Không ảnh hưởng |
|---|---|---|
| Ngưỡng dải | Kiểm nhập mới (SCR-07), kiểm nhiệt khi xuất (SCR-15), gợi ý màu nhiệt | `inbound_lines.temp_ok` đã lưu của phiếu cũ |
| `expiry_type` → `use_by` | Bước ① của allocation cho mọi lô SKU đó; kiểm `EXPIRED_ON_ARRIVAL`; KPI "消費期限 đã đến" | Lịch sử giao |
| `near_expiry_days` | View cận hạn, KPI cận hạn | — |

## 6. Trạng thái

| Đối tượng | Trạng thái |
|---|---|
| Màn | `loading` → `ready` / `error` |
| Mỗi dòng (dải hoặc SKU) | `clean` (nút Lưu tắt) → `dirty` (đã sửa, nút Lưu bật) → gửi → thành công: tải lại, dòng về `clean` / thất bại: giữ giá trị đang sửa, hiện lỗi ở [3] |
| Cấu hình (đích) | `pending` (change request chờ duyệt) → `effective` (phiên bản mới có hiệu lực từ `effective_from`) — ADR-004 |

## 7. Phân quyền

| Thao tác | warehouse | manager | qa / admin (đích) |
|---|---|---|---|
| Xem | ✓ | ✓ | ✓ |
| Sửa ngưỡng / loại hạn / cận hạn | — | ✓ | lập change request |

## 8. [Prototype khác]

| Prototype | Hệ thống đích | Lý do |
|---|---|---|
| 1 giá trị ngưỡng hiện hành / dải, sửa đè | `temperature_zone_versions (zone_id, min_c, max_c, effective_from, effective_to, approved_by)`; đánh giá lại số đo theo **ngưỡng tại thời điểm đo** (ADR-004) | BR-TEMP-01: version theo ngày hiệu lực |
| Đổi `expiry_type` có hiệu lực tức thì, không duyệt | Change request + người duyệt khác (DR-MST-01); cảnh báo số lô/đơn bị ảnh hưởng trước khi duyệt | Đổi 賞味 ↔ 消費 là thay đổi rủi ro cao (hard stop) |
| Không CRUD SKU | Màn master SKU đầy đủ (thêm SKU, JAN, quy cách, đơn vị) | SCR-02 đầy đủ |
