# YCCMS — Yuki Cold-Chain Management System

Dự án thật (bản build) của hệ thống quản lý kho lạnh 3 dải nhiệt cho ユキコールドロジスティクス株式会社. Stack giống prototype (`../yccms-prototype/`): **Next.js 16 + Supabase**. Giai đoạn hiện tại **chỉ chạy local**: Supabase CLI trên Docker, chưa dùng Supabase cloud / Vercel.

## Chạy nhanh

```bash
mkdir -p ~/.colima/_lima/_config && cp scripts/colima-localhost-only.yaml ~/.colima/_lima/_config/override.yaml  # 1 lần/máy: cổng chỉ mở cho 127.0.0.1
colima start --cpu 4 --memory 4   # Docker runtime (macOS); cần `docker` trong PATH: brew link docker
npm install
npm run db:start                  # Supabase local (lần đầu tải image vài phút)
npm run env:local                 # sinh .env.local từ stack đang chạy
npm run db:users                  # tài khoản dev
npm run dev                       # http://localhost:3000
```

Tài khoản dev: `kho@yccms.local` (warehouse) · `quanly@yccms.local`, `quanly2@yccms.local` (manager) · `qa@yccms.local` · `admin@yccms.local`. Mật khẩu `YccmsDev#2026`, chỉ dùng ở local.

Supabase Studio: <http://127.0.0.1:54323> · Mailpit: <http://127.0.0.1:54324> · Kiểm tra sống: <http://localhost:3000/api/health>

Mọi cổng (app 3000, Supabase 54321–54324) chỉ nghe trên `127.0.0.1`, máy khác trong mạng không truy cập được. Chi tiết, lệnh đầy đủ và xử lý sự cố: [docs/00-development/local-development-setup.md](docs/00-development/local-development-setup.md).

## Kiểm tra trước khi push

```bash
npm run typecheck && npm run lint && npm test && npm run db:test && npm run build
npm run test:e2e   # cần npm run dev đang chạy
```

## Tài liệu

[docs/README.md](docs/README.md): kiến trúc, wireframe, đặc tả màn hình/API, ADR, thiết kế DB, roadmap, changelog. Bộ tài liệu dựng từ LAB-4 v1.0, từ đây là bản sống.

## Trạng thái

P0 (nền tảng local: đăng nhập, danh tính & vai trò, test 3 lớp) đã xong. Giai đoạn tiếp theo: P1 master & cấu hình. Xem [docs/development-roadmap.md](docs/development-roadmap.md).
