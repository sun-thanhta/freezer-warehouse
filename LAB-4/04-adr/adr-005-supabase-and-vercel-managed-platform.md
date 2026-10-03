# ADR-005 — Nền tảng managed: Supabase (Postgres + Auth) + Vercel, vùng Tokyo

- **Trạng thái:** Đã chấp nhận. Stack Next.js + Supabase + Vercel do khách/đề bài chốt; ADR này ghi lại hệ quả và điều kiện vận hành
- **Ngày:** 2026-10-03
- **Liên quan:** NFR-PERF-01, NFR-AVL-01, NFR-BCP-01, NFR-SEC-01/03, NFR-LOC-01 · ADR-001, ADR-002

## Bối cảnh

- Đội nhỏ, lịch chặt (go-live 2027-06-01). 1 DC, 80 người dùng đồng thời, khối lượng vừa (~9.000 dòng nhập + xuất/tháng). Không có đội vận hành hạ tầng riêng.
- Yêu cầu không thương lượng: dữ liệu ở Nhật (vùng Tokyo), AVL 99.5% trong 05:00–23:00 JST, RPO 15′ / RTO 4h, SSO + MFA, secret không nằm trong mã nguồn.
- Luật cứng cần một CSDL quan hệ có giao dịch, khóa, ràng buộc, trigger (ADR-001), nên Postgres là lựa chọn tự nhiên.

## Quyết định

- **Supabase** cho Postgres (hàm, RLS, trigger), Auth (phiên, sau này SSO + MFA), sau này Storage (ảnh kiểm nhập, manifest). Project ở `ap-northeast-1` (Tokyo). Production dùng **gói Pro** với PITR.
- **Vercel** cho Next.js (trang + Route Handler). Ghim function region `hnd1` (Tokyo). Preview deployment theo nhánh cho review.
- Ba môi trường dev / staging / prod là ba project Supabase tách biệt. Migration chạy bằng CI với secret của CI, không chạy từ máy cá nhân.
- Trên Vercel chỉ có biến công khai (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Khóa `sb_secret_…` không bao giờ lên Vercel.

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| **A. AWS tự dựng (RDS Postgres + ECS/Lambda + Cognito)** | Kiểm soát tốt hơn, nhưng đội phải tự lo VPC, IAM, deploy, giám sát, auth. Chi phí công sức lớn so với quy mô 80 người dùng. Không có ưu thế chức năng nào mà RFP cần |
| **B. Firebase / Firestore** | NoSQL không có giao dịch nhiều bảng có khóa, ràng buộc, trigger như Postgres. Luật 日付逆転 / tồn kho cần đúng những thứ đó |
| **C. Máy chủ on-premise tại DC Yuki** | RFP không yêu cầu. Thêm rủi ro phần cứng/điện cho mục tiêu 99.5%. Đội vận hành Yuki chỉ có 2 IT |
| **D. Supabase tự host (Docker)** | Mất PITR, cập nhật, giám sát managed. Lại quay về bài toán vận hành của phương án A |

## Hệ quả

**Tốt**
- Từ con số 0 đến bản chạy trên URL thật trong vài giờ. Prototype đang chạy trên đúng nền tảng sẽ dùng cho bản build, nên không có rủi ro "demo một kiểu, build một kiểu".
- Auth, RLS, PITR, TLS, mã hóa at-rest có sẵn. Đội tập trung vào luật nghiệp vụ.
- Preview deployment giúp khách review từng nhánh.

**Xấu, phải chịu**
- **Phụ thuộc nhà cung cấp:**
  - Auth, RLS dựa trên `auth.uid()`, cấu trúc JWT của Supabase.
  - Chuyển sang Postgres thường thì phải thay phần auth và các hàm đọc `auth.uid()`.
  - Phần còn lại là SQL chuẩn nên vẫn mang đi được.
- **Gói miễn phí không dùng được cho production.**
  - Prototype đang ở Supabase Free: tự pause sau ~7 ngày không truy cập, không PITR, đã phải thêm thông báo "Resume project".
  - Vercel Hobby không dành cho mục đích thương mại.
  - Bản build bắt buộc lên Supabase Pro + Vercel Pro, có chi phí hằng tháng phải đưa vào báo giá vận hành.
- **SLA của nhà cung cấp phải đủ cho 99.5% trong khung giờ.** Cần xác nhận SLA của gói đã chọn. Cửa sổ bảo trì của nhà cung cấp không do Yuki kiểm soát, nên có thể rơi vào giờ hoạt động.
- **SSO:**
  - Supabase Auth hỗ trợ SAML 2.0 (gói Pro).
  - Nếu IdP của Yuki chỉ có OIDC thì phải kiểm lại khả năng nối khi có đặc tả IF-IDP-01.
  - Đây vẫn là Assumption trong RFP và là rủi ro tích hợp.
- **Serverless có giới hạn thời gian chạy:** import ERP, xuất báo cáo lớn, đánh giá lại nhiệt hàng loạt phải đặt ở job runner (Supabase cron/queue hoặc worker riêng), không đặt trong Route Handler.
- **Prototype chưa ghim region Vercel** (không có `vercel.json`). Nếu function chạy ngoài Nhật, mỗi request tới Supabase Tokyo tốn thêm độ trễ, và dữ liệu đi qua vùng khác. Phải ghim trước khi đo hiệu năng.
- Giới hạn mặc định 1.000 dòng/truy vấn của API Supabase. Màn đọc nhiều dữ liệu phải phân trang hoặc tổng hợp trong SQL (đã ghi trong từng đặc tả).

## Kiểm chứng / xem xét lại khi

- Load test 80 user trên staging (gói Pro, cùng vùng) đạt p95 đọc ≤ 2s / ghi ≤ 3s.
- Diễn tập restore PITR hằng quý đạt RTO 4h.
- Khách yêu cầu dữ liệu không được nằm ở nhà cung cấp nước ngoài: xem lại phương án A (AWS Tokyo) hoặc Supabase tự host.
