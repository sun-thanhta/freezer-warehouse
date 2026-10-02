# YCCMS Prototype — kho lạnh Yuki

Prototype cho ユキコールドロジスティクス (khách mô phỏng, RFP YCL-RFP-2026-01 v2.0): **kiểm hàng nhập/xuất**, allocation theo chuỗi loại trừ FR-OUT-02 + FEFO, **chặn 日付逆転** (giao lô hạn sớm hơn lô đã giao trước đó cho chính cặp khách-SKU) với duyệt ngoại lệ maker-checker, delivery window theo hợp đồng, khu 隔離, truy xuất gạo/bò. Next.js 16 · Supabase · Vercel. Dữ liệu trong DB là bộ mock đổ sẵn.

| | |
|---|---|
| App (Vercel) | `https://<chưa-deploy>.vercel.app` ← *placeholder — chưa deploy, chờ tài khoản Vercel; điền sau khi deploy* |
| Supabase project | `https://supabase.com/dashboard/project/<project-ref>` ← *placeholder — chưa tạo project, chờ tài khoản Supabase* |

## Tài khoản demo

| Vai trò | Email | Mật khẩu | Quyền khác biệt |
|---|---|---|---|
| Nhân viên kho | `kho@yuki-demo.jp` | `YukiDemo#2026` | Kiểm nhập, xuất kho; vi phạm 日付逆転 bị chặn → gửi đề nghị ngoại lệ |
| Quản lý | `quanly@yuki-demo.jp` | `YukiDemo#2026` | Duyệt đề nghị ngoại lệ của **người khác** (maker-checker), chốt delivery window, sửa ngưỡng nhiệt/SKU, release/scrap lô 隔離 |

## Chạy local

```bash
cd yccms-prototype
cp .env.example .env.local   # điền NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
                             # (+ SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL nếu cần cài DB)
npm install
npm run db:setup             # chỉ lần đầu: schema + mock data + 2 tài khoản demo
npm run dev                  # http://localhost:3000 → màn đăng nhập
```

Lệnh khác: `npm run db:seed` (reset dữ liệu demo) · `npm test` (unit test luật) · `npm run db:test` (test bảo mật SQL) · `npm run test:e2e` (7 kịch bản trên trình duyệt; đặt `E2E_BASE_URL` để chạy với URL Vercel, rồi `npm run db:seed` để reset) · `npm run build`.

> **Lỗi kết nối DB?** ("Không kết nối được database", API 503, đăng nhập báo lỗi kết nối) — project Supabase gói Free tự **pause** khi lâu không dùng. Vào Supabase Dashboard → project → bấm **Resume project**, đợi 1–2 phút rồi tải lại trang.

## Tài liệu

| Thư mục | Nội dung |
|---|---|
| [docs/01-scope/mvp-screens-and-features.md](docs/01-scope/mvp-screens-and-features.md) | **Danh sách màn hình/tính năng bản chốt** + những gì để ngoài so với LAB-1 và vì sao |
| [docs/01-scope/mock-scope-and-production-gap.md](docs/01-scope/mock-scope-and-production-gap.md) | **Phần nào đã mock** và nếu làm thật cần gì |
| [docs/02-technical/](docs/02-technical/) | Kiến trúc, mô hình dữ liệu, API · hướng dẫn deploy Supabase + Vercel |
| [docs/03-demo/demo-script-for-client.md](docs/03-demo/demo-script-for-client.md) | Kịch bản demo 15 phút |
| [docs/04-reports/quick-report-ai-working-notes.md](docs/04-reports/quick-report-ai-working-notes.md) | Quick Report làm việc với AI |
