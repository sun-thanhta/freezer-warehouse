# Hướng dẫn chạy YCCMS ở máy local

Giai đoạn hiện tại **chỉ chạy local**: Supabase (Postgres, Auth, PostgREST, Studio) chạy trong Docker bằng Supabase CLI, app chạy bằng `next dev`. Chưa có Supabase cloud hay Vercel (xem ADR-006).

## 1. Yêu cầu máy

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | ≥ 20.12 (dự án dùng 22.23.1, xem `.node-version`) | |
| Docker runtime | Colima (macOS, khuyên dùng) hoặc Docker Desktop | Cần khoảng 4 GB RAM cho VM; lần đầu tải ~3 GB image |
| Docker CLI | `docker` có trong PATH | Cài qua Homebrew thì phải link: `brew install docker && brew link docker` |
| Supabase CLI | Cài sẵn làm devDependency (`npx supabase …`) | Không cần cài toàn cục |

## 2. Lần đầu

```bash
# 0) Chỉ cho phép truy cập từ chính máy này (làm 1 lần / máy) — xem mục 3
mkdir -p ~/.colima/_lima/_config && cp scripts/colima-localhost-only.yaml ~/.colima/_lima/_config/override.yaml

# 1) Bật Docker runtime (macOS + Colima)
colima start --cpu 4 --memory 4

# 2) Cài thư viện
cd yccms
npm install

# 3) Bật Supabase local (lần đầu tải image, vài phút) — tự áp migration + seed
npm run db:start

# 4) Sinh .env.local từ stack đang chạy (URL + khóa local)
npm run env:local

# 5) Tạo tài khoản dev
npm run db:users

# 6) Chạy app
npm run dev        # http://localhost:3000
```

## 3. Chỉ chạy trên máy này (không mở ra mạng LAN)

YCCMS chỉ chạy local: mọi cổng phải nghe trên `127.0.0.1`, máy khác cùng mạng không được vào.

| Thành phần | Mặc định (không an toàn) | Cách khóa về `127.0.0.1` |
|---|---|---|
| `next dev` / `next start` | `0.0.0.0` (Next.js mặc định) | Đã có sẵn trong `package.json`: `next dev -H 127.0.0.1` |
| Cổng Supabase 54321–54324 | Supabase CLI publish `0.0.0.0`, Colima forward ra `0.0.0.0` của máy thật | File cấu hình máy `~/.colima/_lima/_config/override.yaml` (mẫu: `scripts/colima-localhost-only.yaml`), rồi `colima restart` |

File override nằm **ngoài repo** vì là cấu hình máy, áp cho mọi project Docker chạy trên Colima của máy đó. Muốn bỏ thì xóa file rồi `colima restart`.

Kiểm tra (mọi dòng phải là `127.0.0.1:<cổng>`, không được là `*:<cổng>`):

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(3000|5432[1-4]) '
```

## 4. Địa chỉ local

| Dịch vụ | URL |
|---|---|
| App | <http://localhost:3000> (chỉ nghe trên `127.0.0.1`) |
| Supabase API (kong) | <http://127.0.0.1:54321> |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio (xem bảng, chạy SQL) | <http://127.0.0.1:54323> |
| Mailpit (mail Auth gửi ra) | <http://127.0.0.1:54324> |
| Kiểm tra sống | <http://localhost:3000/api/health> |

Dịch vụ đã **tắt** trong `supabase/config.toml` vì chưa cần: realtime, storage, edge functions, analytics. Bật lại khi module cần (ví dụ storage cho ảnh kiểm nhập).

## 5. Tài khoản dev

Mật khẩu chung: `YccmsDev#2026` (đổi bằng biến `DEV_PASSWORD` khi chạy `npm run db:users`). Script từ chối chạy nếu URL không phải local.

| Email | Vai trò |
|---|---|
| `kho@yccms.local` | warehouse |
| `quanly@yccms.local` | warehouse, manager |
| `quanly2@yccms.local` | warehouse, manager (để thử maker-checker: người duyệt ≠ người lập) |
| `qa@yccms.local` | qa |
| `admin@yccms.local` | admin |

Đăng ký tự do bị tắt (`[auth] enable_signup = false`). Tài khoản chỉ tạo bằng script hoặc Studio.

## 6. Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm run typecheck` · `npm run lint` | Kiểm tĩnh |
| `npm test` | Unit test (vitest, `src/**/*.test.ts`) |
| `npm run test:e2e` | E2E Playwright (`e2e/`), cần `npm run dev` đang chạy và tài khoản dev |
| `npm run db:start` / `db:stop` / `db:status` | Bật / tắt / xem Supabase local (`db:stop` giữ dữ liệu) |
| `npm run db:reset` | Xóa DB local → áp lại toàn bộ migration + `seed.sql` → tạo lại tài khoản dev |
| `npm run db:new <tên>` | Tạo file migration mới `supabase/migrations/<timestamp>_<tên>.sql` |
| `npm run db:test` | Test pgTAP trong `supabase/tests/` (RLS, quyền, luật SQL) |
| `npm run env:local` | Sinh lại `.env.local` |

Quy trình sửa schema: `npm run db:new <tên>` → viết SQL → `npm run db:reset` → viết/sửa test pgTAP → `npm run db:test`.

## 7. Biến môi trường

`.env.local` do `npm run env:local` sinh ra, **không commit** (đã có trong `.gitignore`). Mẫu ở `.env.example`.

| Biến | Dùng ở | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Trình duyệt + server | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Trình duyệt + server | Khóa công khai, RLS bảo vệ dữ liệu |
| `SUPABASE_SECRET_KEY` | Chỉ script dev | **Không bao giờ** thêm tiền tố `NEXT_PUBLIC_`, không dùng trong app (ADR-001) |
| `SUPABASE_DB_URL` | Chỉ script dev | |

Khóa local là khóa dev của Supabase CLI, không phải bí mật production, nhưng vẫn không commit.

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `colima start`: `docker not found` | Docker CLI chưa có trong PATH | `brew link docker` |
| `supabase start`: `docker: command not found` | Như trên | Như trên |
| Studio không lên: `chown …/supabase/snippets: permission denied` | Docker trên Colima không tạo được thư mục mount | Thư mục `supabase/snippets/` phải tồn tại (đã có `.gitkeep`) |
| Đăng nhập báo "Email logins are disabled" | `[auth.email] enable_signup = false` tắt cả nhà cung cấp email | Giữ `[auth.email] enable_signup = true`; chặn đăng ký bằng `[auth] enable_signup = false` |
| App báo "Không kết nối được Supabase local" / API 503 | Stack chưa chạy hoặc Colima đã tắt | `colima start` rồi `npm run db:start` |
| `npm run env:local` báo chưa chạy | Như trên | Như trên |
| API trả 403 "Tài khoản chưa được cấp quyền" | User có ở Auth nhưng thiếu `app_users` / vai trò, hoặc `is_active = false` | `npm run db:users`, hoặc thêm bản ghi trong Studio |
| Next.js cảnh báo chọn sai thư mục gốc | Có lockfile lạc ở thư mục cha | `next.config.ts` đã ghim `turbopack.root` |
| `lsof` thấy `*:5432x` (cổng Supabase mở ra LAN) | Chưa có `override.yaml` hoặc Colima chưa khởi động lại | Mục 3, rồi `npm run db:stop && colima restart && npm run db:start` |
| `lsof` thấy `*:3000` | Chạy `npx next dev` trực tiếp thay vì `npm run dev` | Dùng `npm run dev` (đã có `-H 127.0.0.1`) |
| Đổi `config.toml` không có tác dụng | Supabase chỉ đọc config khi khởi động | `npm run db:stop && npm run db:start` |
