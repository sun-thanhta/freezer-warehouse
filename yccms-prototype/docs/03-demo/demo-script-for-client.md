# Kịch bản demo prototype (~15 phút)

Chuẩn bị: chạy `npm run db:seed` trước buổi demo để dữ liệu về trạng thái ban đầu. Mở 2 cửa sổ trình duyệt (1 thường, 1 ẩn danh) để đổi vai nhanh. Bộ E2E `npm run test:e2e` (7 kịch bản, `e2e/demo-flows.spec.ts`) chạy theo kịch bản này, thêm kiểm tra giao diện điện thoại.

| Bước | Vai | Thao tác | Điều cần nói với khách |
|---|---|---|---|
| 1 | — | Mở URL ở cửa sổ ẩn danh | Không đăng nhập thì không vào được bất kỳ trang nào |
| 2 | Kho (`kho@yuki-demo.jp`) | Đăng nhập → **Tổng quan** | KPI lấy trực tiếp từ DB: 5 đơn mở, 1 dòng bị chặn 日付逆転, 2 hợp đồng chưa chốt window, 1 lô 隔離, 1 lô 消費期限 đã đến |
| 3 | Kho | **Nhập kho & kiểm hàng → + Tạo phiếu nhập**: SUP-01, SKU `CHI-002`, nhập nhiệt `9` | Ngưỡng 冷蔵 **0–5°C do Yuki tự công bố**. Lệch nhiệt thì không được "nhận" — chỉ **Từ chối** hoặc **保留 → khu 隔離 (C-Q-01)**, bắt buộc ghi chú |
| 4 | Kho | Phiếu khác: SKU `CHI-001` (bò), mã cá thể `140812345` (9 số) → **Xác nhận kiểm & nhập kho** | Bò bắt buộc mã đúng 10 số; 9 số → business-review, hệ thống **không tự làm tròn** (R-06) |
| 5 | Kho | **Xuất kho & allocation → OUT-…-01** (CUS-001) | Chuỗi loại trừ FR-OUT-02 hiện trên từng lô: lô gạo cũ **④ quá 1/3** (AGR-001) bị loại; lô há cảo đặt nhầm khu mát **② sai dải**. Gợi ý FEFO chọn lô hợp lệ |
| 6 | Kho | Nhập nhiệt khi xuất `-20` → **Kiểm tra & xác nhận giao** | Nhiệt đo ở dải lạnh nhất của đơn; tồn bị trừ, lịch sử giao cập nhật |
| 7 | Kho | **OUT-…-03** (CUS-003) | **US-02**: CUS-003 đã nhận CHI-002 hạn muộn hơn → mọi lô còn lại bị **⑤ 日付逆転**; salad CHI-004-A **③ đang 隔離**; AGR-008 **chưa chốt → business-review** |
| 8 | Kho | Nhập tay 24 từ `LOT-CHI002-A`, nhiệt xuất `-20` → **Xác nhận giao (có vi phạm 日付逆転)** | **CHẶN**, lượt vi phạm vào nhật ký bất biến |
| 9 | Kho | Nhập lý do → **Gửi đề nghị ngoại lệ** | Người lập đề nghị **không được tự duyệt** (maker-checker, NFR-SEC-02) |
| 10 | Kho | **Cảnh báo 日付逆転** | Đơn bị chặn, đề nghị "Chờ duyệt", nhật ký "Bị chặn" |
| 11 | Quản lý (`quanly@yuki-demo.jp`) | Mở OUT-…-03 → **Duyệt & giao hàng** | Quản lý khác người lập duyệt → giao; nhật ký ghi lý do + người đề nghị + người duyệt |
| 12 | Quản lý | **Hợp đồng khách-SKU** → chốt AGR-008 = 1/2 | Delivery window là tập quán theo hợp đồng, **không phải luật**; dòng chưa chốt không bao giờ tự áp mặc định |
| 13 | Quản lý | **Ngưỡng nhiệt & SKU**, **Tồn kho & 隔離** → release lô `LOT-CHI004-A` về C-03-01 | 賞味期限 = cảnh báo, 消費期限 = hard stop; lô 隔離 khóa tồn tới khi QA quyết định |
| 14 | Quản lý | **Truy xuất nguồn gốc** → số lô `LOT-CHI001-A` → **Truy xuôi**; **Audit log** | Từ lô bò ra khách đã nhận + mã cá thể 10 số; ai làm gì lúc nào |

## Câu hỏi nên hỏi lại khách sau demo

1. 日付逆転 so theo **khách** hay theo **từng cửa hàng/điểm giao** của khách?
2. Ai được duyệt ngoại lệ 日付逆転; có cần duyệt 2 cấp không?
3. Chốt delivery window cho AGR-008 / AGR-014 khi nào, ai là người chốt?
4. Mốc 日付逆転 "最後に受け入れた配送" là **lần giao gần nhất** hay **hạn lớn nhất đã giao**? (prototype dùng hạn lớn nhất — chặt hơn; hai cách chỉ khác nhau sau khi đã duyệt một ngoại lệ)
5. Mã cá thể bò chỉ 9 số: chặn nhận hẳn (prototype hiện làm vậy) hay cho 保留 vào 隔離 chờ business-review?
6. Đặc tả ERP (IF-ERP-01), mapping service (IF-MAP-01), IdP/OIDC (IF-IDP-01) — 3 điểm Assumption để làm vòng prototype tiếp theo (lập tuyến, SSO).
