# Quick Report — làm việc với AI khi dựng prototype YCCMS

Dự án: YCCMS (kho lạnh Yuki) · Bước: prototype MVP từ gói LAB-1 (bản v2 theo RFP) · PL: Thanh Ta · Sun VN02 · 2026-10-03

## 1. Công cụ / skill đã dùng

| Công cụ | Dùng vào việc gì |
|---|---|
| Claude Code (Opus 5.5) + skill **takumi** | Điều phối cả vòng: đọc LAB-1 → chốt phạm vi → plan → code → test → review → tài liệu |
| Đọc RFP gốc (PDF tiếng Nhật, 89 trang) bằng pypdf | Lấy đúng fixture: 12 SKU (R-02), 15 hợp đồng AGR (R-04), bố trí kho/隔離 (R-01), ca kiểm thử (R-06) |
| Subagent **reviewer** (4 vòng) | Đọc toàn bộ code + SQL, tự dựng thí nghiệm trên Postgres local để tái hiện lỗi |
| Subagent **tester** + Playwright | E2E trên trình duyệt; bộ cuối cùng 7 kịch bản ở `e2e/`, chạy lại được với URL Vercel |
| Tài liệu Next.js đi kèm package | Tra API Next 16 thay vì dựa trí nhớ của AI |
| Postgres 14 + PostgREST 16.4 + gateway Node giả lập Supabase Auth | Chạy thật API ↔ DB khi máy không có Docker và chưa đăng nhập Supabase |
| vitest, psql | 13 unit test luật; 26 test hồi quy SQL (`npm run db:test`) |

## 2. Chỗ AI sinh sai & cách phát hiện / sửa

| Chỗ sai | Phát hiện bằng cách nào | Đã sửa |
|---|---|---|
| **Dựng trên tài liệu lỗi thời**: AI đọc LAB-1 lúc đầu (bản v1 — giả định, ~1.200 SKU, 冷蔵 0–10°C, 1/3 theo khách); trong lúc làm, LAB-1 được thay bằng **v2 theo RFP thật** (12 SKU, 冷蔵 0–5°C, hợp đồng khách-SKU, chuỗi loại trừ 6 bước, 隔離, maker-checker). Prototype đã qua test + review nhưng **trái RFP** | Soát lại thư mục đầu vào trước khi bàn giao: tên file trong LAB-1 đã đổi, README ghi "bản v2 là bản dùng chính" | Đọc RFP gốc, dựng lại schema/seed/luật/màn hình theo v2, viết lại toàn bộ test, review lại vòng 4 |
| **Bảo mật DB**: bản đầu cho mọi user đã đăng nhập ghi mọi bảng → nhân viên kho tự nâng mình thành manager rồi tự duyệt 日付逆転; user không có hồ sơ gọi thẳng hàm SQL thì lọt chốt chặn (`NULL OR false`) | Reviewer tái hiện trên Postgres local | RLS chặn ghi trực tiếp, hàm SQL tự kiểm người gọi, test SQL — **thử khôi phục chính sách cũ để chắc test bắt được lỗi** |
| Hàm giao hàng so 日付逆転 với cả dòng nó vừa ghi → chặn nhầm; 2 đơn cùng khách giao đồng thời cùng lọt kiểm tra | Reviewer (thử 2 phiên song song) | Chụp mốc trước vòng lặp + khóa theo khách × SKU |
| **Tester AI báo "PASS, production-ready"** nhưng chỉ kiểm trang tải được, ghi mã HTTP vào ô exit code, không có ảnh chụp; lần 2 đoán sai nguyên nhân treo đăng nhập | Đối chiếu evidence thô | Sửa CORS ở gateway giả lập, tự viết bộ Playwright và **tự xem ảnh chụp** — nhờ đó bắt được một assert yếu (chữ "CHẶN" trùng với banner có sẵn) |
| AI viết theo Next.js cũ (`middleware.ts`) trong khi Next 16 đã đổi thành `proxy.ts` | `AGENTS.md` của Next cảnh báo → đọc docs đi kèm | Dùng `src/proxy.ts`, `params` dạng Promise |
| Hàm SQL không kiểm nhiệt khi xuất (gọi thẳng giao được ở 99°C); audit giả được tên người khác; ngày `2026-13-45` gây lỗi 500 | Reviewer, smoke test curl | Kiểm nhiệt trong SQL, trigger đóng dấu người thực hiện, kiểm ngày → 422 |

Bài học: (1) **soát lại đầu vào trước khi bàn giao** — tài liệu có thể đổi giữa chừng; (2) **không tin báo cáo "xong" của AI** — đòi bằng chứng thô (lệnh + exit code thật, dòng DB, ảnh chụp) và cho một agent khác review với nhiệm vụ "tìm cách phá".

## 3. Số giờ thật đã dùng (gộp theo tuần)

| Tuần | Nội dung | Giờ |
|---|---|---|
| Tuần 1–2 | LAB-1: phân tích, estimate, proposal (xem Quick Report LAB-1) | ~12.0h |
| Tuần 3 (28/9–4/10/2026) | Chốt MVP, code prototype, test + review, căn chỉnh lại theo RFP v2, tài liệu | ~4.5h |
| Tuần 3 | Tạo project Supabase, deploy Vercel, điền link vào README (làm tay) | ~0.5h |
| **Tổng prototype** | | **~5.0h** |

Ghi chú: số giờ là ước lượng theo bước 0.5h — chỉnh lại theo giờ thực tế trước khi nộp.
