# Quick Report — làm việc với AI khi dựng prototype YCCMS

Dự án: YCCMS (kho lạnh Yuki) · Bước: prototype MVP từ LAB-1 (bản v2 theo RFP) · PL: Thanh Ta · Sun VN02 · 2026-10-03
Kết quả: <https://yccms-prototype.vercel.app> · Supabase project `upngghuyjvwhlxaqqqml` · repo `sun-thanhta/freezer-warehouse`

## 1. Công cụ / skill đã dùng

| Công cụ | Dùng vào việc gì |
|---|---|
| Claude Code (Opus 5.5) + skill **takumi** | Điều phối cả vòng: đọc LAB-1 → chốt phạm vi → plan → code → test → review → tài liệu → deploy |
| pypdf, openpyxl | Đọc RFP gốc (PDF tiếng Nhật, 89 trang) và workbook v2 để lấy đúng fixture: 12 SKU, 15 hợp đồng AGR, bố trí kho/隔離, ca kiểm thử |
| Subagent **reviewer** (5 vòng), **tester**, **doc-writer**, **git-manager** | Review "tìm cách phá" có tái hiện trên DB; E2E; soát tài liệu khớp code; commit/push có quét secret |
| Postgres 14 + PostgREST + gateway giả lập Supabase Auth | Chạy thật API ↔ DB khi chưa có tài khoản cloud và máy không có Docker |
| vitest · psql · Playwright | 13 unit test luật, 26 test hồi quy bảo mật SQL, 7 kịch bản E2E — chạy lại cả trên Supabase thật và URL production |
| Supabase · Vercel CLI · gh | Cài DB bằng `npm run db:setup`, deploy production, push code |

## 2. Chỗ AI sinh sai & cách phát hiện / sửa

| Chỗ sai | Phát hiện | Cách sửa |
|---|---|---|
| **Dựng trên tài liệu lỗi thời**: đọc LAB-1 bản v1 (giả định, 冷蔵 0–10°C, 1/3 theo khách); giữa chừng LAB-1 được thay bằng v2 theo RFP thật (12 SKU, 冷蔵 0–5°C, hợp đồng khách-SKU, chuỗi loại trừ 6 bước, 隔離, maker-checker) → prototype đã qua test + review nhưng **trái RFP** | Soát lại thư mục đầu vào trước khi bàn giao: tên file đổi, README ghi "v2 là bản chính" | Đọc RFP gốc, dựng lại schema / seed / luật / màn hình, viết lại toàn bộ test, review thêm 2 vòng |
| **Lỗ hổng bảo mật DB**: mọi user đã đăng nhập ghi được mọi bảng → nhân viên kho tự nâng thành quản lý rồi tự duyệt 日付逆転; user không có hồ sơ gọi thẳng hàm SQL thì lọt chốt chặn (`NULL OR false`) | Reviewer tái hiện được trên Postgres | Chặn ghi trực tiếp, hàm SQL tự kiểm người gọi; viết test và **thử khôi phục chính sách cũ để chắc test bắt được lỗi** |
| Lỗi logic khó thấy: so 日付逆転 với cả dòng vừa ghi trong cùng lần giao; 2 đơn giao đồng thời cùng lọt; đơn giao trễ lọt hard stop 消費期限; gọi thẳng hàm giao được ở 99°C; người duyệt ngoại lệ không thấy lô mình duyệt | Reviewer (có thử 2 phiên song song) | Chụp mốc trước vòng lặp, khóa theo khách × SKU, xét theo max(ngày giao, hôm nay), kiểm nhiệt trong SQL, hiện chi tiết đề nghị |
| **Tester AI báo "PASS, production-ready"** nhưng chỉ kiểm trang tải được, ghi mã HTTP vào ô exit code, không có ảnh; lần 2 đoán sai nguyên nhân treo đăng nhập | Đối chiếu bằng chứng thô (file kết quả, thư mục ảnh rỗng) | Tìm ra gateway giả lập thiếu CORS; tự viết bộ Playwright và **tự xem ảnh chụp** → bắt thêm một assert yếu (chữ "CHẶN" trùng banner có sẵn) |
| Viết theo Next.js cũ (`middleware.ts`) trong khi Next 16 đổi thành `proxy.ts` | Cảnh báo trong `AGENTS.md` của Next | Đọc tài liệu đi kèm package trước khi viết |
| Khi deploy: code đọc tên biến cũ (`…ANON_KEY`) trong khi Supabase cấp key kiểu mới (`sb_publishable_…`); mật khẩu DB có `@` làm hỏng chuỗi kết nối; `vercel link` tự ghi thêm token vào `.env.local` — file chứa secret có nguy cơ bị upload | Đối chiếu biến môi trường thực tế, thử kết nối DB trước khi cài, đọc lại `.env.local` sau mỗi lệnh CLI (chỉ in tên biến) | Nhận cả 2 tên biến, mã hóa `@` → `%40`, dùng session pooler 5432, thêm `.vercelignore` chặn `.env*`; chỉ 2 biến công khai lên Vercel |

**Bài học:** (1) soát lại đầu vào trước khi bàn giao — tài liệu có thể đổi giữa chừng; (2) không tin báo cáo "xong" của AI — đòi bằng chứng thô (lệnh + exit code thật, dòng DB, ảnh chụp) và cho một agent khác review với nhiệm vụ "tìm cách phá"; (3) kiểm lại trên môi trường thật — cùng bộ test chạy lần lượt trên DB giả lập, Supabase thật và URL production.

## 3. Số giờ thật đã dùng (gộp theo tuần)

| Tuần | Nội dung | Giờ |
|---|---|---|
| Tuần 1–2 | LAB-1: phân tích, estimate, proposal (xem Quick Report LAB-1) | ~12.0h |
| Tuần 3 (28/9–4/10/2026) | Chốt MVP, code, test + review, căn chỉnh theo RFP v2, tài liệu | ~4.5h |
| Tuần 3 | Cấu hình Supabase, deploy Vercel, kiểm thử trên production | ~0.5h |
| **Tổng prototype** | | **~5.0h** |

Ghi chú: số giờ là ước lượng theo bước 0.5h — chỉnh lại theo giờ thực tế trước khi nộp.
