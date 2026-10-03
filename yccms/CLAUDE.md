@AGENTS.md

# CLAUDE.md — yccms (dự án thật)

- Đây là bản build thật, **không phải** prototype. Làm theo thiết kế ở `docs/` (dựng từ LAB-4); `../yccms-prototype/` chỉ để tham khảo cách làm, chỗ prototype khác thiết kế ghi **[Prototype khác]** trong docs.
- **Chỉ chạy local** (ADR-006): Supabase CLI trên Docker/Colima, mọi cổng chỉ nghe trên `127.0.0.1` (`next dev -H 127.0.0.1` + `~/.colima/_lima/_config/override.yaml`). Không thêm cấu hình Supabase cloud / Vercel, không mở cổng ra mạng.
- Trước khi làm module mới: đọc `docs/development-roadmap.md`, `docs/05-database/01-er-diagram-and-table-design.md`, đặc tả màn trong `docs/03-detail-design/`, `docs/00-development/code-standards.md`.
- Lệnh: `npm run db:start` · `env:local` · `db:users` · `dev` · `db:reset` (áp lại migration + tạo lại user) · `db:new <tên>` · `db:test` (pgTAP) · `test` · `test:e2e` · `typecheck` · `lint` · `build`.
- Bắt buộc: RLS deny-by-default, ghi nghiệp vụ qua hàm `SECURITY DEFINER` (ADR-001); app không dùng secret key; mọi bảng/hàm mới có test pgTAP; sửa luật thì sửa cả TS và SQL.
- Xong việc: cập nhật `docs/05-database/03-implementation-status.md`, `docs/development-roadmap.md`, `docs/project-changelog.md`.
- Lệnh `supabase`/`docker` cần `docker` trong PATH (`brew link docker`) và Colima đang chạy.
