# ADR-003 — Kiểm 日付逆転: mốc theo cặp khách × SKU, hai lớp, khóa theo cặp, ngoại lệ maker-checker

- **Trạng thái:** Đã chấp nhận, đã cài. Diễn giải "最後に受け入れた配送" chờ khách xác nhận (Q2); phạm vi khách hay điểm giao chờ xác nhận (Q1)
- **Ngày:** 2026-10-03
- **Liên quan:** BR-DATE-01, US-02, DR-HIST-01, NFR-SEC-02, R-06 · ADR-001

## Bối cảnh

- RFP cấm giao cho khách một lô có hạn **sớm hơn** lô khách đó đã nhận trước đó (日付逆転禁止). Siêu thị xếp kệ theo hạn; nhận lô cũ sau lô mới thì phải xử lý tay hoặc trả hàng.
- Các bẫy RFP liệt kê là "lỗi nghiêm trọng" (S5-03): so với **hôm nay** thay vì lịch sử giao; mượn lịch sử của **khách khác** (ca R-06: CUS-003 đã nhận CHI-002 hạn X, còn CUS-004/CUS-005 không bị ảnh hưởng).
- Có ngoại lệ hợp lệ (khách đồng ý bằng văn bản), nhưng phải có **hai người**: người lập ≠ người duyệt.
- Rủi ro kỹ thuật tái hiện được ở review:
  - So lô với chính dòng vừa ghi trong cùng lần giao, nên phân bổ không theo FEFO bị chặn oan.
  - Hai đơn của cùng khách × SKU giao đồng thời cùng đọc mốc cũ và cùng lọt (write skew).
  - Người duyệt không thấy mình đang duyệt lô nào.

## Quyết định

1. **Mốc** = `max(expiry_date)` trong `delivery_history` của **đúng cặp (customer_id, product_id)**. Lô vi phạm khi `expiry_date < mốc` (bằng mốc thì hợp lệ). Không có lịch sử thì không có ràng buộc.
2. **Hai lớp kiểm:**
   - TS (`isDateReversal` ở `rules/allocation-chain-rules.ts`, gọi từ `pick-plan-service`) đánh dấu ⑤ trên từng lô để gợi ý và cảnh báo trước khi giao (màn `/alerts`).
   - SQL (`_validate_shipment`) là chốt cuối.
3. Trong SQL, **chụp mốc vào biến trước vòng lặp ghi** (`v_last_map`), để lần giao hiện tại không tự nâng mốc của chính nó.
4. **Khóa** `pg_advisory_xact_lock(customer_id, product_id)` cho mọi SKU của đơn, theo thứ tự product_id tăng dần, sau khi khóa đơn và trước khi đọc mốc.
5. Có lô ⑤ mà không có lý do → **409** và ghi lượt `blocked` (1 lần/vi phạm). Có lý do → `override_requests` (`pending`) **lưu cố định bộ phân bổ + nhiệt độ**. Manager khác người lập duyệt → `_perform_shipment` chạy lại toàn bộ kiểm tra có khóa trên dữ liệu hiện tại, rồi ghi `overridden` kèm lý do + người đề nghị + người duyệt.
6. Mỗi đơn tối đa 1 đề nghị `pending` (index duy nhất có điều kiện). Đơn được giao bằng đường khác thì đề nghị còn treo chuyển `cancelled`.

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| **A. Mốc = hạn của lần giao gần nhất (theo thời gian)** | Sau khi duyệt một ngoại lệ (giao lô cũ), mốc sẽ **tụt xuống**: lần sau giao tiếp lô cũ hơn nữa mà không bị chặn. "Hạn lớn nhất" thì không bao giờ tụt, chặt hơn và đúng mục đích của luật. Chờ khách xác nhận (Q2): nếu khách chọn A, chỉ phải đổi `last_deliveries` và đoạn chụp mốc |
| **B. So với ngày hôm nay / hạn tối thiểu còn lại** | Đúng là bẫy RFP liệt kê: đó là luật hạn dùng (đã có ① và ④), không phải 日付逆転 |
| **C. Mốc theo SKU toàn hệ thống (mọi khách)** | Mượn lịch sử khách khác, sai ca R-06 |
| **D. Chỉ kiểm ở TS (BFF)** | Gọi thẳng RPC/PostgREST là lách được; hai request song song cùng lọt (không có khóa xuyên request ở BFF) |
| **E. Chỉ kiểm ở SQL** | Người dùng chỉ biết bị chặn sau khi bấm giao. Không có màn cảnh báo trước, không chỉ ra được từng lô vi phạm gì. RFP cần cảnh báo **trước** khi giao (US-02) |
| **F. Khóa mức bảng / `SERIALIZABLE` cho mọi giao dịch giao hàng** | Khóa bảng chặn cả các khách không liên quan. `SERIALIZABLE` làm giao dịch lỗi ngẫu nhiên, phải tự viết retry ở client. Advisory lock theo cặp chỉ chặn đúng phần đụng nhau |
| **G. Duyệt ngoại lệ theo "đơn" rồi người lập tự giao sau** | Giữa lúc duyệt và lúc giao, người lập đổi được lô, nên người duyệt không biết mình duyệt cái gì. Lưu cố định bộ phân bổ và giao ngay khi duyệt thì loại được khe hở này |

## Hệ quả

**Tốt**
- Ca R-06 chạy đúng trên dữ liệu thật: OUT-…-03 (CUS-003/CHI-002) bị chặn; OUT-…-05 (CUS-005/CHI-002) giao được lô cũ. Ca CUS-003 có cả E2E và test SQL; ca CUS-005 có test SQL và unit test, **chưa có E2E**.
- Không có write skew giữa hai đơn cùng cặp khách × SKU. Reviewer đã tái hiện bằng 2 phiên psql song song: trước khi thêm khóa thì cả hai cùng lọt, sau khi thêm thì phiên sau bị chặn.
- Nhật ký bất biến đủ để kiểm toán: ai bị chặn, lô nào, mốc nào, ai đề nghị, ai duyệt, lý do.
- Người duyệt thấy đúng các lô sẽ giao (`items[]`), và hệ thống giao đúng bộ đó.

**Xấu, phải chịu**
- **Chặt hơn một cách diễn giải của RFP** (Q2). Nếu khách hiểu theo "lần giao gần nhất", hệ thống đang chặn nhiều hơn khách muốn sau khi đã có ngoại lệ. Phải xác nhận trước khi build; chi phí đổi nhỏ (1 hàm đọc + 1 đoạn SQL + test).
- **Một ngoại lệ đã duyệt không hạ mốc**, nên sau khi ngoại lệ giao lô cũ, các lô cũ còn lại vẫn bị chặn (mỗi lần cần một ngoại lệ). Đây là hành vi cố ý, nhưng khách có thể thấy phiền.
- Advisory lock dùng khóa 2 số nguyên `(customer_id, product_id)`, chung không gian khóa với mọi advisory lock khác trong DB. Nếu sau này module khác cũng dùng advisory lock 2 tham số thì có thể đụng nhau. Quy ước: chỉ module giao hàng dùng dạng 2 tham số; module khác dùng dạng 1 tham số với namespace riêng.
- Phạm vi "theo khách" có thể sai nếu khách thật ra cần **theo từng cửa hàng** (Q1). ER đích đã có `customer_sites`; đổi phạm vi là đổi khóa nhóm của mốc + khóa advisory.
- Bộ phân bổ lưu trong đề nghị có thể **cũ** khi được duyệt (tồn đổi, lô đến hạn). Lúc đó duyệt thất bại với lỗi rõ ràng, đề nghị vẫn `pending`, nhưng người lập phải tự hủy và lập lại. Chưa có nút hủy đề nghị ở prototype; bản đích thêm thao tác hủy và `expires_at`.
- Logic ⑤ nằm ở hai nơi (ADR-001: hệ quả viết luật hai lần).

## Kiểm chứng / xem xét lại khi

- Khách trả lời Q1/Q2.
- Test hiện có: unit (`isDateReversal`, mốc bằng nhau được phép, khách chưa có lịch sử), SQL (`DATE_REVERSAL` cho CUS-003/CHI-002, CUS-005 không mượn lịch sử, phân bổ không theo FEFO không bị chặn oan, `SELF_APPROVAL`, duyệt xong thì giao và ghi nhật ký), E2E (chặn → đề nghị → manager khác duyệt).
- **Chưa có test tự động cho đồng thời:** test SQL chạy trong một giao dịch nên không mô phỏng được 2 phiên. Bản build cần thêm test 2 kết nối song song (ví dụ script Node mở 2 client `pg`).
