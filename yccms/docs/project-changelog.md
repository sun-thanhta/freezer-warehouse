# Nhật ký thay đổi

Ghi theo ngày, mới nhất ở trên. Mỗi dòng: loại (`thêm` / `sửa` / `bảo mật` / `tài liệu`), nội dung, ảnh hưởng.

## 2026-10-03 — P0 Nền tảng local

- **bảo mật** Chỉ nghe trên `127.0.0.1`: trước đó `next dev` và 4 cổng Supabase mở trên mọi interface (máy khác trong LAN vào được app, Studio và Postgres với mật khẩu mặc định). Sửa: `next dev/start -H 127.0.0.1`; mẫu `scripts/colima-localhost-only.yaml` cho `~/.colima/_lima/_config/override.yaml`. Kiểm từ IP LAN: 3000, 54321–54324 đều đóng.
- **thêm** Khung dự án `yccms/`: Next.js 16.3.8, React 19.2, Tailwind 4, TypeScript 5, ESLint 9, Vitest 5, Playwright; cùng phiên bản thư viện với prototype.
- **thêm** Supabase chạy local bằng Supabase CLI 2.119 trên Docker (Colima): Postgres 17, Auth, PostgREST, Studio, Mailpit. Tắt realtime, storage, edge functions, analytics (chưa cần).
- **thêm** Migration `20261003060000_identity_and_roles`: `roles` (8 vai trò), `app_users` (FK `auth.users`), `user_roles`; hàm `current_user_roles()`, `has_role()`, `is_provisioned()`; RLS deny-by-default.
- **thêm** Cổng đăng nhập (`proxy.ts`), `withAuth` (401 / 403 / 503), `requireRole`, `/api/me`, `/api/health`, trang đăng nhập và trang chủ tạm.
- **bảo mật** `?next=` sau đăng nhập chỉ nhận đường dẫn cùng origin (`safeNextPath`), chặn open redirect. Đăng ký tự do bị tắt.
- **thêm** Script `env:local` (sinh `.env.local` từ stack local) và `db:users` (5 tài khoản dev, chỉ chạy với URL local).
- **thêm** Test: unit 3 ca (`safeNextPath`), pgTAP 9 ca (RLS danh tính), E2E 3 ca (cổng đăng nhập, đăng nhập đúng/sai).
- **tài liệu** `docs/` dựng từ LAB-4 v1.0, thêm hướng dẫn chạy local, quy ước code, roadmap, changelog, ADR-006, trạng thái cài đặt DB.
