# SCR-03 — Hợp đồng khách-SKU · Lịch sử giao theo khách (DR-HIST-01)

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Mục đích | Quản lý delivery window theo **từng hợp đồng khách × SKU** (R-04, BR-DELWIN-01) và xem lịch sử giao bất biến, tức nền của 日付逆転 |
| URL | `/customers` (S09) · `/customers/[id]` (S10) |
| Vai trò | Xem: mọi vai trò · Chốt/đổi window: `manager` |
| API | `GET /api/customers` · `PATCH /api/agreements/[id]` · `GET /api/customers/[id]?sku=&from=&to=` · `GET /api/me` |
| Wireframe | [WF-09](../02-wireframes/wireframe-04-master-trace-audit.md#wf-09--hợp-đồng-khách-sku-scr-03) · [WF-10](../02-wireframes/wireframe-04-master-trace-audit.md#wf-10--lịch-sử-giao-theo-khách-dr-hist-01) |
| Yêu cầu | BR-DELWIN-01, R-04, US-04, DR-HIST-01, DR-MST-01 |

## 2. S09 — Bảng phần tử

| No. | Tên | Kiểu | Nguồn / quy tắc |
|---|---|---|---|
| 1 | Tiêu đề | label | Nhấn mạnh: window là tập quán thương mại, **không phải luật** |
| 2 | Thông báo | alert | Thành công: "{AGR}: delivery window → {nhãn} (ghi audit, áp dụng cho lần allocation tiếp theo)." · lỗi: đỏ |
| 3 | Thẻ khách | card | `customers.code`, `name` (sắp theo `code`) |
| 4 | Lịch sử giao (n) → | link | n = `customer_delivery_summary().deliveries` → `/customers/{id}` |
| 5 | Giao gần nhất | label | `last_delivered_at` |
| 6a | Hợp đồng | label | `customer_sku_agreements.code` |
| 6b | SKU | label + badge | `products.sku`, `name`, loại hạn |
| 6c | Điều kiện giao | label | `delivery_term`: `軒先渡し` / `車上渡し` |
| 6d / 7 | Delivery window | select | Giá trị: `ONE_THIRD` "1/3" · `ONE_HALF` "1/2" · `LABEL_DATE_ONLY` "Chỉ hạn trên nhãn". Khi `NULL`: thêm lựa chọn đầu "Chưa chốt (business-review)", viền + nền cam. `disabled` nếu không phải manager. Đổi giá trị → gửi ngay (không có nút Lưu) |
| 6e | Hiệu lực | date | `effective_from` |

## 3. Validation (PATCH window)

| # | Quy tắc | Lớp | Thông báo |
|---|---|---|---|
| V1 | Vai trò `manager` | BFF + RLS (`manager_update`) + GRANT cột `window_rule, updated_at` | 403 "Chỉ quản lý được đổi delivery window." |
| V2 | `window_rule` ∈ {ONE_THIRD, ONE_HALF, LABEL_DATE_ONLY}; **không nhận NULL** (đã chốt thì không quay về "chưa chốt") | BFF chặn NULL. CHECK của DB chỉ chặn giá trị lạ và **vẫn nhận NULL** (khe hở prototype; bản đích thêm trigger) | 422 "Quy tắc chỉ nhận ONE_THIRD / ONE_HALF / LABEL_DATE_ONLY" |
| V3 | Hợp đồng tồn tại | BFF | 404 "Không tìm thấy hợp đồng" |
| V4 | id số nguyên dương | BFF | 404 |

Ghi audit: trigger `audit_config_change` → `customer_sku_agreements.update` với `before` / `after`.

## 4. Sự kiện

| Sự kiện | Xử lý | Thành công | Thất bại |
|---|---|---|---|
| Mở S09 | `GET /api/customers` (khách + tóm tắt giao + hợp đồng) | Danh sách thẻ | Hộp lỗi |
| Đổi [7] | `PATCH /api/agreements/{id} {window_rule}` | [2] xanh, tải lại | [2] đỏ, select về giá trị cũ khi tải lại |

## 5. S10 — Lịch sử giao theo khách

| No. | Tên | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|---|
| 1 | Tiêu đề | label | — | "Lịch sử giao — {name}", badge `code` |
| 2 | ← Khách hàng | link | — | `/customers` |
| 3 | SKU | text | — | Tự viết hoa; lọc **khớp đúng** `products.sku` |
| 4 | Từ ngày | date | — | Lọc `delivered_at ≥ from`. **[Prototype khác]** prototype so với 00:00 **UTC** (= 09:00 JST), nên giao lúc 00:00–09:00 JST của ngày `from` bị loại; bản đích dùng `from 00:00 +09:00`. Sai định dạng → 400 "Ngày lọc không hợp lệ" |
| 5 | Đến ngày | date | — | Lọc `delivered_at ≤ to 23:59:59 +09:00` (cuối ngày theo JST) |
| 6a | Ngày giao | datetime | — | `delivery_history.delivered_at` (mới nhất trước) |
| 6b | Đơn | link | — | `outbound_orders.code` → `/outbound/{id}`; "—" nếu NULL (dữ liệu migration) |
| 6c | SKU | label | — | `products.sku`, `name` |
| 6d | Lô | label | — | `lots.lot_no` |
| 6e | Hạn dùng | date + badge | — | `expiry_date` (hạn **lúc giao**, lưu riêng, không đọc lại từ lô); `‹mốc 日付逆転›` tím ở dòng có hạn lớn nhất của mỗi SKU, **ẩn khi đang lọc ngày** |
| 6f | SL | number | — | `qty` |

Đổi bộ lọc là gọi lại API ngay. Không đúng `id` khách → 404 "Không tìm thấy khách hàng". Rỗng: "Chưa có lịch sử giao phù hợp."

`delivery_history` **bất biến**: không có màn hay API sửa/xóa. Giao trả về (return) xử lý bằng bản ghi bù ở module trả hàng (đích, SCR-17), không sửa dòng cũ.

## 6. Trạng thái

| Đối tượng | Trạng thái |
|---|---|
| Màn S09, S10 | `loading` → `ready` / `empty` / `error` (quy tắc chung). Đổi select [7] không có trạng thái "đang lưu" riêng: gửi xong thì tải lại cả trang |
| Hợp đồng (`window_rule`) | `NULL` (chưa chốt, viền cam) → `ONE_THIRD` / `ONE_HALF` / `LABEL_DATE_ONLY`, đổi qua lại giữa 3 giá trị; không quay về `NULL` (xem business-rules mục 2.5) |
| Lịch sử giao | Bất biến; không có chuyển trạng thái |

## 7. Phân quyền

| Thao tác | warehouse | manager | sales (đích) |
|---|---|---|---|
| Xem S09, S10 | ✓ | ✓ | ✓ |
| Đổi delivery window | — (select khóa) | ✓ | lập change request |

## 8. [Prototype khác]

| Prototype | Hệ thống đích | Lý do |
|---|---|---|
| Manager sửa đè `window_rule`, có hiệu lực ngay | Tạo **phiên bản hợp đồng mới** (`effective_from` / `effective_to`) qua change request; người khác duyệt (ADR-004) | DR-MST-01: effective-dated + maker-checker; allocation của đơn đã lên kế hoạch không bị đổi ngầm |
| Ràng buộc `UNIQUE (customer_id, product_id)` (1 hợp đồng/cặp) | `UNIQUE (customer_id, product_id, effective_from)` + ràng buộc không chồng khoảng hiệu lực | Nhiều phiên bản |
| Không CRUD khách / hợp đồng; dữ liệu từ seed | Màn master khách (SCR-04) + thêm hợp đồng | |
| Không có điểm giao (cửa hàng) | `customer_sites`; lịch sử giao ghi `site_id` | Q1 |
| Lọc SKU khớp đúng, không phân trang | Tìm gần đúng, phân trang, xuất CSV | |
