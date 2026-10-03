# Luật nghiệp vụ, máy trạng thái & danh mục mã lỗi

Tài liệu này gom các luật dùng chung cho nhiều màn. Mỗi luật ghi rõ chỗ cài đặt ở **cả hai lớp**: TypeScript cho gợi ý/hiển thị, SQL cho chốt chặn. Sửa luật thì phải sửa cả hai lớp, và phải có test cho cả hai.

## 1. Bảng luật

| Mã | Luật | TS (`yccms-prototype/src/lib/`) | SQL (`supabase/migrations/`) | Test |
|---|---|---|---|---|
| BR-TEMP-01 | Ngưỡng 3 dải do Yuki tự công bố: 常温 15–25 · 冷蔵 0–5 · 冷凍 ≤ −18 °C; đọc từ `temperature_zones`, NULL = không giới hạn | `rules/temperature-rules.ts` | `confirm_inbound_receipt`, `_validate_shipment` | unit + SQL |
| BR-TEMP-02 | Lệch nhiệt khi nhận → chỉ 拒否 hoặc 保留 (vị trí -Q cùng dải) + ghi chú; lô ở vị trí khác dải không được xuất (②) | `services/inbound-validation-service.ts`, `rules/allocation-chain-rules.ts` | `TEMP_DEVIATION`, `INVALID_LOCATION`, `ZONE_MISMATCH` | unit + SQL + E2E |
| BR-EXP-01 | Loại hạn khai theo SKU: 賞味期限 (`best_before`) = cảnh báo; 消費期限 (`use_by`) = hard stop | `products.expiry_type` | CHECK | — |
| BR-EXP-02 | 消費期限 ≤ ngày tham chiếu → không nhận (khi nhập), không giao (①), ghi exception bất biến | `evaluateLot` (①) | `EXPIRED_ON_ARRIVAL`, `USE_BY_EXPIRED`, insert BR-EXP-02 | unit + SQL |
| FR-INV-05 | Lô 隔離 không vào allocation (③); chỉ manager release/scrap | `evaluateLot` (③) | `LOT_QUARANTINED`, `resolve_quarantine` | SQL + E2E |
| BR-DELWIN-01 | 納品期限 theo hợp đồng khách × SKU; NULL = business-review; ④ loại khỏi gợi ý, chọn tay chỉ cảnh báo | `rules/delivery-window-rules.ts` | (cố ý không kiểm) | unit |
| BR-DATE-01 | Hạn lô < hạn lớn nhất đã giao cho **cặp khách × SKU** → chặn (⑤); ngoại lệ qua maker-checker | `isDateReversal`, `pick-plan-service` | `_validate_shipment` (mốc chụp trước), `DATE_REVERSAL`, advisory lock | unit + SQL + E2E |
| BR-FEFO-01 | Còn lại xếp hạn sớm trước; cùng hạn → nhập trước (FIFO) | `sortFefo`, `suggestAllocation` | — (người dùng có thể chọn tay) | unit |
| BR-TRACE-01/02 | Gạo bắt buộc `産地・取引`; bò bắt buộc mã **đúng 10 số**, 9 số → business-review, không làm tròn | `rules/traceability-rules.ts` | `RICE_TRACE_REQUIRED`, `BEEF_ID_REVIEW`, `BEEF_ID_INVALID` | unit + SQL + E2E |
| NFR-SEC-02 | Người lập đề nghị ≠ người duyệt | UI ẩn nút | `SELF_APPROVAL` | SQL + E2E |
| FR-REC-x | Ngày nhận trong [hôm nay − 7, hôm nay] (JST) | `inspectInboundLines` | `INVALID_ARRIVAL_DATE` | SQL |

### 1.1 Ngày tham chiếu

- **Hôm nay** = ngày theo Asia/Tokyo (`todayJst()`; SQL: `(now() at time zone 'Asia/Tokyo')::date`).
- **Ngày tham chiếu khi giao** = `max(ship_date, hôm nay)`. Đơn giao trễ thì xét theo hôm nay, để không lọt lô vừa đến 消費期限.
- **Khi nhập**: `EXPIRED_ON_ARRIVAL` so với `arrival_date`.

### 1.2 Thứ tự chuỗi loại trừ FR-OUT-02

① 消費期限 → ② sai dải nhiệt → ③ 隔離 → ④ delivery window → ⑤ 日付逆転 → FEFO (FIFO khi hòa). Thứ tự này cố định theo RFP. TS và SQL phải giữ cùng thứ tự để mã lỗi đầu tiên hai bên trùng nhau.

### 1.3 Công thức 納品期限

`deadline = mfg_date + floor((expiry_date − mfg_date) × r)` với r = 1/3 (`ONE_THIRD`), 1/2 (`ONE_HALF`). `LABEL_DATE_ONLY`: deadline = `expiry_date`. Vi phạm khi `refDate > deadline`.
Ví dụ (seed): `LOT-AMB001-A` NSX = hôm nay − 200, hạn = hôm nay + 165 → khoảng 365 ngày → 1/3 = 121 ngày → deadline = hôm nay − 79 → **④ quá window** với AGR-001 (ONE_THIRD).

### 1.4 Dải nhiệt khi xuất

Một đơn có thể gồm nhiều dải. Nhiệt khi xuất đo ở **dải lạnh nhất** (dải có `max_c` nhỏ nhất, NULL coi là +∞). Khoảng chấp nhận = `[max(min_c), min(max_c)]` của các dòng thuộc dải đó.

## 2. Máy trạng thái

### 2.1 Lô (`lots.status`)

| Từ → Đến | Điều kiện | Ai | Hàm |
|---|---|---|---|
| (mới) → `available` | Dòng nhập `accepted` | warehouse, manager | `confirm_inbound_receipt` |
| (mới) → `quarantine` | Dòng nhập `hold`, vị trí -Q | warehouse, manager | `confirm_inbound_receipt` |
| `quarantine` → `available` | Lý do + vị trí thường cùng dải | manager | `resolve_quarantine('release')` |
| `quarantine` → `scrapped` | Lý do; `qty_on_hand := 0` | manager | `resolve_quarantine('scrap')` |
| `available` → `available` | Giao (trừ `qty_on_hand`) | warehouse, manager | `_perform_shipment` |
| **Đích** `available` → `quarantine` | QA/logger phát hiện lệch | qa | (mới) |
| **Đích** (mới) → `review` | Mã bò 9 số, chờ business-review | warehouse | (mới) — Q3 |

### 2.2 Dòng nhập (`inbound_lines.result`)

Bất biến sau khi ghi: `accepted` | `rejected` | `hold`. Phiếu (`inbound_receipts`) không sửa/xóa.

### 2.3 Đơn xuất (`outbound_orders.status`)

`open` → `shipped` (qua `confirm_shipment` hoặc `decide_override(approve)`). Không có đường quay lại. Đích thêm `cancelled` (ERP hủy) và `allocated` nếu tách bước pick (SCR-14).

### 2.4 Đề nghị ngoại lệ (`override_requests.status`)

`pending` → `approved` | `rejected` | `cancelled`. Tối đa 1 `pending`/đơn. Trạng thái cuối không đổi được nữa.

### 2.5 Hợp đồng khách-SKU (`window_rule`)

`NULL` (chưa chốt, business-review) → một trong 3 giá trị → đổi qua lại giữa 3 giá trị. **Không** quay về `NULL`. Ở prototype chỉ BFF chặn việc này; CHECK của DB vẫn nhận NULL. Đích: mỗi lần đổi là một phiên bản mới, có trigger chặn NULL sau lần chốt đầu.

## 3. Đồng thời và khóa

| Khóa | Phạm vi | Ở đâu |
|---|---|---|
| `SELECT … FOR UPDATE` đơn | 1 đơn | `_perform_shipment` |
| `pg_advisory_xact_lock(customer_id, product_id)` | Cặp khách × SKU, xếp product_id tăng dần để tránh deadlock | `_perform_shipment` |
| `SELECT … FOR UPDATE` lô | Từng lô trong phân bổ, xếp theo `lot_id` | `_validate_shipment(p_lock=true)` |
| `SELECT … FOR UPDATE` đề nghị | 1 đề nghị | `decide_override` |
| `SELECT … FOR UPDATE` lô 隔離 | 1 lô | `resolve_quarantine` |

`request_override` gọi `_validate_shipment(p_lock=false)`: chỉ kiểm, không khóa, vì chưa ghi tồn. Lần kiểm có khóa diễn ra lúc duyệt.

## 4. Ràng buộc dữ liệu chính (đã có trong DB)

| Ràng buộc | Ý nghĩa |
|---|---|
| `lots (product_id, lot_no)` UNIQUE | Một số lô chỉ một lần cho mỗi SKU |
| `lots.qty_on_hand >= 0` | Cấm tồn âm (FE-09) |
| `inbound_lines.expiry_date >= mfg_date` | |
| `customer_sku_agreements (customer_id, product_id)` UNIQUE | 1 hợp đồng / cặp (đích: theo phiên bản) |
| `allocation_exceptions_once (rule, order_id, lot_id, decision)` | Mỗi vi phạm ghi 1 lần |
| `override_requests_one_pending (order_id) WHERE status='pending'` | 1 đề nghị chờ / đơn |
| CHECK miền giá trị | `expiry_type`, `trace_lane`, `status`, `result`, `window_rule` (vẫn nhận NULL), `delivery_term`, `role`, `rule`, `decision` |
| **Chưa có ở DB** (chỉ BFF kiểm) | `min_c <= max_c`, ít nhất một ngưỡng, `near_expiry_days` 0–365, số lô không rỗng sau trim |

## 5. Lớp kiểm thử bảo vệ luật

| Lớp | Lệnh | Số ca | Nội dung |
|---|---|---|---|
| Unit (vitest) | `npm test` | 13 | Chuỗi loại trừ, FEFO/FIFO, window, nhiệt, mã bò |
| SQL hồi quy | `npm run db:test` | 26 | Tự nâng quyền, ghi thẳng bảng bị chặn, anon không đọc được, thiếu profile, actor đóng dấu từ JWT, ①②③⑤ trong SQL (① với đơn giao trễ), nhiệt xuất, không mượn lịch sử khách khác, ghi BR-EXP-02, maker-checker (tự duyệt, warehouse duyệt), 隔離, mã bò 9 số, lùi ngày nhận, lệch nhiệt, audit cấu hình (chạy trong một giao dịch rồi rollback). **Chưa có** test đồng thời 2 phiên |
| E2E (Playwright) | `npm run test:e2e` | 7 | Theo kịch bản demo, cả giao diện điện thoại |

## 6. Danh mục mã lỗi SQL → HTTP → thông báo

| Mã | HTTP | Thông báo (prototype) | Phát sinh ở |
|---|---|---|---|
| `NO_PROFILE` | 403 | Tài khoản chưa được cấp quyền (thiếu hồ sơ người dùng). | mọi hàm ghi |
| `FORBIDDEN` | 403 | Chỉ quản lý được thực hiện thao tác này. | `resolve_quarantine`, `decide_override` |
| `USE_BY_EXPIRED` | 422 | 消費期限 đã đến/quá — HARD STOP, không được giao. | `_validate_shipment` |
| `ZONE_MISMATCH` | 422 | Lô đang nằm sai dải nhiệt — không được giao. | `_validate_shipment` |
| `LOT_QUARANTINED` | 422 | Lô đang 隔離 — chờ QA release. | `_validate_shipment` |
| `DATE_REVERSAL` | 409 | CHẶN: vi phạm 日付逆転禁止 (kiểm tra cuối ở database). | `_perform_shipment` |
| `SHIP_TEMP_OUT_OF_RANGE` | 422 | Nhiệt độ khi xuất ngoài ngưỡng — xử lý chuỗi lạnh trước khi giao. | `_validate_shipment` |
| `INSUFFICIENT_STOCK` | 409 | Tồn kho đã thay đổi, không đủ số lượng — tải lại trang. | `_validate_shipment` |
| `ORDER_NOT_OPEN` | 409 | Đơn đã được giao hoặc đóng — tải lại trang. | `_perform_shipment`, `request_override` |
| `ORDER_NOT_FOUND` | 404 | Không tìm thấy đơn xuất. | `_perform_shipment` |
| `ALLOCATION_MISMATCH` | 422 | Phải phân bổ đủ số lượng cho từng dòng đơn. | `_validate_shipment` |
| `LINE_NOT_IN_ORDER` | 422 | Có dòng phân bổ không thuộc đơn này. | `_validate_shipment` |
| `LOT_PRODUCT_MISMATCH` | 422 | Lô không đúng sản phẩm của dòng đơn. | `_validate_shipment` |
| `INVALID_QTY` | 422 | Số lượng phân bổ phải lớn hơn 0. | `_validate_shipment` |
| `NO_REVERSAL` | 422 | Phân bổ này không vi phạm 日付逆転 — không cần đề nghị ngoại lệ. | `request_override` |
| `REQUEST_NOT_PENDING` | 409 | Đề nghị đã được xử lý. | `decide_override` |
| `SELF_APPROVAL` | 403 | Người lập đề nghị không được tự duyệt (maker-checker) — cần quản lý khác. | `decide_override` |
| `REASON_REQUIRED` | 422 | Bắt buộc nhập lý do. | `request_override`, `decide_override`, `resolve_quarantine` |
| `NOT_A_VIOLATION` | 422 | Không phải vi phạm thật — không ghi nhật ký. | trigger `verify_blocked_exception` |
| `INVALID_ARRIVAL_DATE` | 422 | Ngày nhận chỉ được trong 7 ngày gần nhất và không ở tương lai. | `confirm_inbound_receipt` |
| `NO_LINES` | 422 | Phiếu nhập phải có ít nhất 1 dòng. | 〃 |
| `INVALID_SUPPLIER` / `INVALID_PRODUCT` / `INVALID_RESULT` | 422 | Nhà cung cấp / Sản phẩm / Kết quả kiểm không hợp lệ. | 〃 |
| `TEMP_REQUIRED` | 422 | Bắt buộc nhập nhiệt độ khi nhận. | 〃 |
| `TEMP_DEVIATION` | 422 | Nhiệt độ ngoài ngưỡng — chỉ được Từ chối hoặc 保留 (隔離), kèm ghi chú. | 〃 |
| `EXPIRED_ON_ARRIVAL` | 422 | 消費期限 đã đến/quá ngay khi nhận — không được nhập kho. | 〃 |
| `RICE_TRACE_REQUIRED` | 422 | Gạo (米トレーサビリティ法): bắt buộc 産地・取引. | 〃 |
| `BEEF_ID_REVIEW` | 422 | Mã cá thể bò chỉ có 9 số → business-review, không tự làm tròn. | 〃 |
| `BEEF_ID_INVALID` | 422 | Mã cá thể bò phải đúng 10 chữ số. | 〃 |
| `INVALID_LOCATION` | 422 | Vị trí không hợp lệ (sai dải nhiệt hoặc sai loại vị trí 隔離/thường). | `confirm_inbound_receipt`, `resolve_quarantine` |
| `LOT_NOT_QUARANTINED` | 409 | Lô không còn ở trạng thái 隔離. | `resolve_quarantine` |
| `INVALID_ACTION` | 422 | Thao tác không hợp lệ. | `resolve_quarantine` |
| (Postgres `23505`) | 409 | Số lô trùng / đề nghị pending trùng | BFF bắt riêng |
| (Postgres `22P02`) | 400 | Tham số không hợp lệ. | `assertNoDbError` |

Mã có hậu tố `:<chi tiết>` (ví dụ `USE_BY_EXPIRED:LOT-CHI003-A`) được nối vào thông báo trong ngoặc. Mã không có trong danh mục → 500, nội dung chỉ ghi log server.
