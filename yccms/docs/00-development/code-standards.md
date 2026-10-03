# Quy ước code

Áp dụng cho mọi code trong `yccms/`. Kiến trúc nền ở `01-basic-design/02-architecture-and-data-flow.md` và ADR-001, ADR-002.

## 1. Cấu trúc thư mục

```
yccms/
├── src/proxy.ts              # cổng đăng nhập cho trang (Next 16: middleware → proxy)
├── src/app/login/            # SCR-00
├── src/app/(app)/            # các màn sau đăng nhập (client component, gọi /api/*)
├── src/app/api/              # Route Handler = BFF; mọi route bọc withAuth (trừ /api/health)
├── src/components/           # UI dùng chung
├── src/lib/api/              # withAuth, requireRole, ApiError, ánh xạ mã lỗi SQL
├── src/lib/auth/             # helper xác thực thuần (safe-next-path…)
├── src/lib/client/           # use-api (fetch phía trình duyệt)
├── src/lib/rules/            # luật nghiệp vụ thuần, không I/O, có unit test (sẽ thêm theo module)
├── src/lib/services/         # gộp dữ liệu cho màn hình (sẽ thêm theo module)
├── src/lib/supabase/         # client server/browser, env, phát hiện mất kết nối
├── supabase/config.toml      # cấu hình Supabase local
├── supabase/migrations/      # schema + RLS + hàm SQL (timestamp_tên.sql)
├── supabase/seed.sql         # dữ liệu local sau migration
├── supabase/tests/           # pgTAP
├── scripts/                  # công cụ dev (env, tài khoản dev)
├── e2e/                      # Playwright
└── docs/                     # tài liệu sống
```

## 2. Code

- File < 200 dòng; tên file kebab-case mô tả rõ mục đích (`pick-plan-service.ts`, không `utils.ts`).
- Trang lấy dữ liệu qua `useApi('/api/…')`. Không gọi bảng Supabase từ trình duyệt; supabase-js ở trình duyệt chỉ dùng để đăng nhập/đăng xuất (ADR-002).
- Route Handler gọi Supabase bằng **JWT người dùng** (`createSupabaseServerClient`). **Không** dùng secret/service key trong app.
- Kiểm vai trò ở BFF bằng `requireRole(auth, …)` để báo lỗi sớm; quyền thật nằm ở RLS / hàm SQL.
- Lỗi DB đi qua `assertNoDbError`; không trả nội dung lỗi Postgres về client. Mã lỗi nghiệp vụ mới thì thêm vào `src/lib/api/rpc-error-messages.ts` **và** danh mục ở `03-detail-design/business-rules-and-state-machines.md` §6.
- Ngày nghiệp vụ theo JST; không dùng `new Date()` của client để quyết định "hôm nay".
- Next.js 16 khác bản cũ: đọc `node_modules/next/dist/docs/` trước khi dùng API lạ (xem `AGENTS.md`).
- UI tiếng Việt + thuật ngữ Nhật (giai đoạn này); nhãn song ngữ ở `03-detail-design/00-common-screen-rules.md` §8.

## 3. Database / migration

- RLS **deny-by-default** cho mọi bảng mới: bật RLS, thu hồi quyền ghi của `authenticated` và mọi quyền của `anon`, chỉ cấp `select` kèm policy (ADR-001).
- Mọi thao tác ghi nghiệp vụ là **một hàm SQL `SECURITY DEFINER`** có `set search_path = public, pg_temp`, tự kiểm `auth.uid()` + `is_provisioned()` / `has_role()` + luật, ghi audit trong cùng giao dịch.
- Mọi FK có index phía con. Ràng buộc dữ liệu bằng CHECK ở DB, không chỉ ở BFF (bài học prototype D-16, D-21).
- Bảng sự kiện (lịch sử giao, nhật ký ngoại lệ, audit, sổ di chuyển tồn) bất biến: chặn UPDATE/DELETE bằng quyền **và** trigger.
- Dữ liệu tham chiếu dùng chung mọi môi trường (vd `roles`) nằm trong migration; dữ liệu demo/fixture nằm trong `seed.sql`.
- Không sửa migration đã merge; thêm migration mới.

## 4. Test

| Lớp | Công cụ | Khi nào bắt buộc |
|---|---|---|
| Luật thuần | vitest, file `*.test.ts` cạnh code | Mọi luật trong `src/lib/rules/` |
| SQL / RLS / hàm | pgTAP, `supabase/tests/*_test.sql` | Mọi bảng mới (RLS) và mọi hàm `SECURITY DEFINER` |
| Luồng người dùng | Playwright, `e2e/*.spec.ts` | Mỗi màn hình lõi có ít nhất một kịch bản chính |

Sửa luật thì sửa cả TS **và** SQL, test cả hai lớp. Test phải fail được với code sai (không viết test chỉ để xanh).

## 5. Git

- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`), scope `yccms` khi cần phân biệt với prototype: `feat(yccms): …`.
- Không commit `.env*` (trừ `.env.example`). Trước khi push: `npm run typecheck && npm run lint && npm test && npm run db:test`.
- PR đổi hành vi phải cập nhật tài liệu liên quan trong `docs/` cùng PR.
