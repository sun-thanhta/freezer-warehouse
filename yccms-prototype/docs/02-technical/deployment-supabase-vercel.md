# Hướng dẫn deploy: Supabase + Vercel

Thời gian: ~15 phút. Cần tài khoản Supabase và Vercel (gói miễn phí là đủ).

> **Trạng thái:** Supabase đã cấu hình (project `upngghuyjvwhlxaqqqml`, Tokyo: schema, dữ liệu mock, 2 tài khoản demo; 26 test SQL và 7 kịch bản E2E pass trên DB thật). Vercel: đã deploy production tại <https://yccms-prototype.vercel.app> (project `yccms-prototype`, deploy bằng CLI từ thư mục `yccms-prototype/`; 7 kịch bản E2E pass trên URL production). Deploy lại: `cd yccms-prototype && npx vercel deploy --prod`.

## 1. Tạo project Supabase

1. <https://supabase.com/dashboard> → **New project** → Region: **Northeast Asia (Tokyo)** → đặt *Database password* (ghi lại).
2. Lấy thông tin ở **Project Settings**:
   - *Data API* → **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - *API Keys* → **publishable** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; **secret** (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (key kiểu cũ anon / service_role cũng dùng được với tên `…_ANON_KEY` / `…_SERVICE_ROLE_KEY`)
   - Nút **Connect** → *Session pooler* (IPv4, cổng **5432** — không dùng cổng 6543 transaction pooler) → `SUPABASE_DB_URL`, thay `[YOUR-PASSWORD]`; ký tự đặc biệt phải mã hóa URL (`@` → `%40`)
3. **Authentication → Sign In / Providers → Email**: tắt **Allow new users to sign up**. Anon key là công khai; tắt đăng ký để người lạ không tự tạo được tài khoản. (Kể cả khi tạo được, API vẫn trả 403 vì tài khoản đó không có bản ghi `profiles`.)

## 2. Cài DB + dữ liệu mock + tài khoản demo

```bash
cd yccms-prototype
cp .env.example .env.local      # điền 4 biến ở bước 1
npm install
npm run db:setup                # áp schema + hàm RPC, nạp mock, tạo 2 tài khoản demo
```

Script chạy lại nhiều lần vẫn an toàn — nhưng mỗi lần chạy đều nạp lại bộ mock (xóa dữ liệu nghiệp vụ hiện có). Muốn **reset demo** về trạng thái ban đầu (sau khi đã bấm thử giao hàng…): `npm run db:seed`. Kiểm tra lớp bảo mật SQL: `npm run db:test` (26 test, tự rollback; cần dữ liệu vừa seed).

Không dùng script được? Mở **SQL Editor** và chạy lần lượt `supabase/migrations/0001_schema.sql`, `0002_row_level_security.sql`, `0003_inbound_functions.sql`, `0004_outbound_functions.sql`, `0005_read_functions.sql`, rồi `supabase/seed/seed-mock-data.sql`; rồi tạo 2 user ở **Authentication → Users → Add user** (tick *Auto confirm*) và thêm 2 dòng vào bảng `profiles` (`id` = UUID user, `email`, `full_name`, `role` = `warehouse` / `manager`).

## 3. Chạy local

```bash
npm run dev     # http://localhost:3000 → tự chuyển tới /login
```

## 4. Deploy Vercel

### Cách A — CLI

```bash
npx vercel login
cd yccms-prototype
npx vercel link                                   # tạo project mới, root = thư mục hiện tại
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod                                 # in ra URL production
```

### Cách B — Dashboard

1. Push repo lên GitHub → Vercel **Add New → Project** → import repo.
2. **Root Directory** = `yccms-prototype` (framework tự nhận Next.js).
3. **Environment Variables**: chỉ thêm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   **Không** đưa `SUPABASE_SECRET_KEY` / `SUPABASE_DB_URL` lên Vercel — app không cần, chỉ script setup dùng.
4. Deploy.

## 5. Kiểm tra sau deploy

- [ ] Mở URL production ở cửa sổ ẩn danh → thấy màn **đăng nhập**, không thấy nội dung bên trong.
- [ ] `curl -i https://<app>.vercel.app/api/dashboard` → `401`.
- [ ] Đăng nhập `kho@yuki-demo.jp` → dashboard có số liệu.
- [ ] (Tùy chọn) chạy E2E với bản deploy: `npx playwright install chromium` (lần đầu) rồi `E2E_BASE_URL=https://<app>.vercel.app npm run test:e2e`, xong `npm run db:seed` để trả dữ liệu demo.
- [ ] Cập nhật link Supabase + URL Vercel vào `README.md`.

## 6. Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Đăng nhập báo "Không kết nối được database Supabase", API trả 503 | Project Supabase Free bị **pause** sau ~7 ngày không dùng | Dashboard → project → **Resume project**, đợi 1–2 phút |
| `/login?error=config` | Thiếu 2 biến `NEXT_PUBLIC_*` trên Vercel | Thêm env rồi **Redeploy** (biến `NEXT_PUBLIC_*` được nhúng lúc build) |
| API trả 403 "chưa được cấp quyền" | User có trong Auth nhưng thiếu dòng `profiles` | Chạy lại `npm run db:setup` |
| `db:setup` lỗi `ENOTFOUND` / `ECONNREFUSED` | Dùng *Direct connection* (IPv6) hoặc project đang pause | Dùng *Session pooler* string; Resume project |
| Dữ liệu demo "cũ" (đơn đã giao hết) | Đã bấm thử nhiều lần | `npm run db:seed` |
