# Trạng thái cài đặt database

Đối chiếu thiết kế [01-er-diagram-and-table-design.md](01-er-diagram-and-table-design.md) với migration đã có trong `yccms/supabase/migrations/`. Cập nhật mỗi khi thêm migration.

## Đã cài

| Bảng / hàm | Migration | Khác thiết kế? | Test |
|---|---|---|---|
| `roles` (8 vai trò, dữ liệu nằm trong migration) | `20261003060000_identity_and_roles` | Không | pgTAP `identity_rls_test.sql` |
| `app_users` (FK `auth.users` on delete restrict, `is_active`) | 〃 | Thêm `updated_at` (quy ước bảng master) | 〃 |
| `user_roles` (PK `user_id, role_code`, index FK phía con) | 〃 | Không | 〃 |
| `current_user_roles()`, `has_role(text)`, `is_provisioned()` | 〃 | Thêm `is_provisioned()` (= active và có ≥ 1 vai trò) để dùng trong policy đọc | 〃 |

Quyền: mọi bảng bật RLS; `anon` không có quyền; `authenticated` chỉ `select`. Policy: catalogue `roles` cho người đã cấp quyền; `app_users` / `user_roles` cho chính chủ, hoặc `admin` xem tất cả. Ghi chỉ qua script dev (secret key) — bản build sẽ thêm hàm quản trị người dùng (SCR-33).

## Chưa cài

Toàn bộ 26 bảng còn lại của thiết kế, theo thứ tự trong [../development-roadmap.md](../development-roadmap.md): P1 master & cấu hình (kèm `audit_logs`, `change_requests`) → P2 nhập kho & tồn → P3 xuất kho.
