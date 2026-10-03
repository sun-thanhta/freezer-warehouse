# ADR-004 — Master và cấu hình có phiên bản theo ngày hiệu lực, thay đổi qua change request

- **Trạng thái:** Đề xuất cho bản build. **Prototype chưa làm**: đang sửa đè + trigger audit trước → sau
- **Ngày:** 2026-10-03
- **Liên quan:** DR-MST-01, BR-TEMP-01, BR-DELWIN-01, BR-EXP-01, NFR-SEC-02, NFR-AUD-01 · ADR-001

## Bối cảnh

- RFP yêu cầu master (SKU, khách, NCC, vị trí, thiết bị) **effective-dated** và **maker-checker** (DR-MST-01). Ngưỡng nhiệt có **version theo ngày hiệu lực** (BR-TEMP-01).
- Ba loại cấu hình quyết định hard stop:
  - Ngưỡng nhiệt: nhận / từ chối / 隔離, xuất được hay không.
  - Loại hạn theo SKU (`best_before` ↔ `use_by`): bật/tắt hard stop ①.
  - Delivery window theo hợp đồng (④).
  Đổi sai một giá trị là ảnh hưởng mọi lô của SKU ngay lập tức.
- Prototype: manager sửa đè giá trị hiện hành. Trigger `audit_config_change` ghi trước → sau, nhưng:
  - **Không đánh giá lại được quá khứ**: nhìn phiếu nhập tháng trước, không biết ngưỡng **lúc đó** là bao nhiêu. Màn chi tiết phiếu đang hiện ngưỡng hiện hành.
  - Đổi có hiệu lực ngay, không có người thứ hai kiểm, không đặt trước được ngày áp dụng (ví dụ hợp đồng mới từ đầu tháng).
  - Hợp đồng bị ràng buộc `UNIQUE (customer_id, product_id)`, nên không giữ được lịch sử phiên bản.

## Quyết định

1. Cấu hình có rủi ro cao lưu dạng **bảng phiên bản**, mỗi phiên bản có `effective_from` (bao gồm) và `effective_to` (không bao gồm, NULL = đang hiệu lực), cùng `approved_by`, `approved_at`:
   - `temperature_zone_versions (zone_id, min_c, max_c, …)`
   - `product_versions (product_id, expiry_type, near_expiry_days, …)`
   - `customer_sku_agreements` đổi thành nhiều dòng theo phiên bản: `UNIQUE (customer_id, product_id, effective_from)` + ràng buộc **không chồng khoảng** (`EXCLUDE USING gist` trên `daterange`).
2. Luật đọc **phiên bản có hiệu lực tại ngày tham chiếu**:
   - Kiểm nhập: ngày nhận.
   - Allocation và giao: ngày tham chiếu khi giao.
   - Đánh giá lại số đo nhiệt: thời điểm đo.
   Viết thành hàm SQL (`zone_range_at(zone_id, date)`, `agreement_at(customer, product, date)`) để TS và SQL dùng chung một định nghĩa.
3. Mọi thay đổi đi qua **`change_requests`** (entity, entity_id, payload_before, payload_after, effective_from, status `pending|approved|rejected|cancelled`, requested_by, decided_by). Người duyệt ≠ người lập. Duyệt xong mới sinh phiên bản mới (một giao dịch).
4. Trước khi duyệt, màn hiện **tác động**: số lô còn tồn, số dòng đơn mở bị đổi kết quả allocation.
5. Giữ `audit_config_change` cho bảng phiên bản; change request có audit riêng (`change.request|approve|reject`).

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| **A. Giữ sửa đè + audit (như prototype)** | Không đáp ứng DR-MST-01 và BR-TEMP-01. Không trả lời được câu hỏi kiểm toán "lô này bị chặn theo ngưỡng nào" nếu không đọc ngược audit JSON. Không đặt trước được ngày áp dụng |
| **B. Temporal table / system-versioning (lịch sử theo thời gian giao dịch)** | Postgres không có sẵn (cần extension). Quan trọng hơn: ghi lại **thời điểm sửa**, còn nghiệp vụ cần **ngày hiệu lực** (đặt trước, áp từ ngày 1). Hai khái niệm khác nhau |
| **C. Event sourcing toàn bộ master** | Quá nặng cho 12 SKU / 15 hợp đồng / 3 dải. Đọc trạng thái phải dựng lại từ sự kiện, làm phức tạp mọi truy vấn allocation |
| **D. Tách change request thành dịch vụ workflow riêng (BPM)** | Thêm hạ tầng. Số loại thay đổi ít, một bảng + hàm duyệt là đủ |
| **E. Phiên bản hóa mọi bảng master** | YAGNI. Chỉ phiên bản hóa cấu hình làm đổi kết quả hard stop. Tên, địa chỉ… chỉ cần audit |

## Hệ quả

**Tốt**
- Trả lời được "lúc đó ngưỡng/window là gì" cho mọi quyết định cũ. Màn chi tiết phiếu nhập hiện đúng ngưỡng tại ngày nhận.
- Đặt trước được thay đổi theo hợp đồng (ví dụ AGR-008 áp 1/2 từ 2026-11-01).
- Đổi 賞味 ↔ 消費 hoặc ngưỡng nhiệt luôn có người thứ hai xem tác động rồi mới áp dụng.

**Xấu, phải chịu**
- **Truy vấn nào cũng phải thêm điều kiện ngày hiệu lực.** Pick-plan, kiểm nhập, dashboard đều phức tạp hơn và dễ sai (quên điều kiện thì đọc nhầm phiên bản). Giảm thiểu: chỉ đọc qua hàm `*_at(date)`, có test cho ranh giới ngày (hôm trước / đúng ngày / hôm sau).
- Thêm 3–4 bảng, 1 màn hàng chờ duyệt (SCR-05 phần master), và thêm bước duyệt. Thay đổi khẩn (ngưỡng sai gây chặn toàn bộ nhập hàng) bị chậm vì phải chờ người duyệt → cần quy trình "khẩn" (2 manager online), hoặc cho admin duyệt ngoài giờ.
- Migration từ prototype: mỗi giá trị hiện hành thành phiên bản đầu tiên (`effective_from` = ngày go-live hoặc ngày hợp đồng `2026-04-01`). Phải viết lại các chỗ đang đọc trực tiếp `temperature_zones.min_c/max_c`, `products.expiry_type`, `customer_sku_agreements.window_rule`.
- Phiên bản tương lai làm UI phức tạp hơn: phải hiển thị "đang hiệu lực" lẫn "sắp hiệu lực".
- `EXCLUDE USING gist` cần extension `btree_gist` (có sẵn trên Supabase nhưng phải bật).

## Kiểm chứng / xem xét lại khi

- Test ranh giới ngày cho cả 3 loại cấu hình. Test duyệt: người lập ≠ người duyệt; duyệt sinh đúng một phiên bản, đóng `effective_to` của phiên bản trước.
- Nếu khách xác nhận chỉ cần lịch sử (không cần đặt trước, không cần duyệt): rút về phương án A + lưu ngưỡng áp dụng ngay vào dòng dữ liệu (`inbound_lines.zone_min_c/max_c`).
