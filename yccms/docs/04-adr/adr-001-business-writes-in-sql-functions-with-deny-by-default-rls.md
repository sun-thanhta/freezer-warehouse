# ADR-001 — Ghi nghiệp vụ qua hàm SQL `SECURITY DEFINER`, RLS chặn ghi trực tiếp

- **Trạng thái:** Đã chấp nhận, đã cài ở prototype (`0002_row_level_security.sql`, `0003`, `0004`)
- **Ngày:** 2026-10-03
- **Liên quan:** NFR-SEC-02, NFR-AUD-01, BR-DATE-01, BR-EXP-02 · ADR-002, ADR-003

## Bối cảnh

- Supabase cấp cho trình duyệt một khóa công khai (`sb_publishable_…`). Ai có khóa này và một JWT hợp lệ đều gọi thẳng PostgREST được, **không cần đi qua app**. Vì vậy chỉ kiểm quyền và luật ở Next.js là không đủ.
- Các luật cứng của RFP là hard stop có hậu quả pháp lý/thương mại: 消費期限, 日付逆転, maker-checker, nhiệt độ. RFP yêu cầu chúng **không thể bị lách**, và vi phạm phải để lại dấu vết bất biến.
- Một lần giao hàng ghi 5–6 bảng (`lots`, `delivery_history`, `outbound_orders`, `allocation_exceptions`, `override_requests`, `audit_logs`). Ghi nửa chừng là sai tồn kho và sai mốc 日付逆転.
- Review vòng 1 tìm ra lỗ hổng tái hiện được: khi `authenticated` còn quyền ghi bảng, nhân viên kho tự `update profiles set role='manager'` rồi tự duyệt ngoại lệ của mình.

## Quyết định

1. **RLS deny-by-default** trên mọi bảng `public`. Đọc chỉ khi `app_role() is not null` (người dùng có bản ghi `profiles`). Thu hồi `insert/update/delete/truncate` của `authenticated` và mọi quyền của `anon`.
2. Chỉ mở ghi hẹp ở 3 chỗ:
   - Manager `UPDATE` **đúng các cột cấu hình**, cấp bằng `GRANT UPDATE (cột)` kèm policy `manager_update`.
   - `INSERT` lượt `blocked` vào `allocation_exceptions`. Trigger `verify_blocked_exception` tự tính lại nội dung, `stamp_actor` đóng dấu người thực hiện.
   - `INSERT` `audit_logs` với `actor_id = auth.uid()`. Ứng dụng thật ra không dùng đường này (hàm SQL và trigger ghi audit bằng quyền owner), nên bản build sẽ bỏ nó.
3. Mọi thao tác ghi nghiệp vụ là **một hàm SQL `SECURITY DEFINER`** (`confirm_inbound_receipt`, `resolve_quarantine`, `confirm_shipment`, `request_override`, `decide_override`). Mỗi hàm `search_path = public, pg_temp`, tự kiểm `auth.uid()` + `profiles` + vai trò + toàn bộ luật, và chạy trong **một giao dịch**.
4. Hàm nội bộ (`_validate_shipment`, `_perform_shipment`) **không** cấp execute cho ai. Chỉ hàm công khai gọi được chúng.
5. Audit cấu hình do **trigger DB** ghi (`audit_config_change`), không phụ thuộc code API.

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| **A. API Next.js dùng service role, kiểm quyền trong TypeScript, trình duyệt không có quyền gì** | Service role bỏ qua RLS. Chỉ cần một route quên kiểm quyền là lộ toàn bộ DB. Khóa đặc quyền phải nằm trên server Vercel, nên diện bị lộ lớn hơn. Luật vẫn có thể bị vượt bởi bất kỳ script nào cầm khóa. Giao dịch nhiều bảng qua supabase-js không có transaction phía client → phải viết RPC kiểu gì cũng vậy |
| **B. RLS cho phép ghi theo từng bảng (policy insert/update chi tiết), app ghi trực tiếp** | Luật xuyên bảng không diễn đạt được bằng policy từng dòng: "tổng phân bổ theo lô ≤ tồn", "hạn lô ≥ mốc đã giao của cặp khách × SKU", "người duyệt ≠ người lập". Policy càng phức tạp càng khó review. Không có tính nguyên tử khi ghi nhiều bảng |
| **C. Service backend riêng (NestJS/Go) giữ kết nối DB, Postgres chỉ là kho lưu** | Thêm một dịch vụ phải vận hành, theo dõi, scale, trong khi RFP chỉ có 80 người dùng đồng thời. Đội phải tự viết lại auth/session mà Supabase đã có. Không bỏ được nhu cầu chặn truy cập PostgREST, nên vẫn phải khóa DB |
| **D. Supabase Edge Functions chứa luật** | Vẫn cần service role hoặc gọi lại RPC; luật nằm cách xa dữ liệu nên vẫn phải tự lo khóa và giao dịch; thêm runtime Deno vào stack |

## Hệ quả

**Tốt**
- Luật cứng (①②③⑤, maker-checker, tồn kho, nhiệt) chỉ có **một chốt cuối**, ngay cạnh dữ liệu. Gọi thẳng PostgREST bằng anon key + JWT cũng không lách được. 26 test hồi quy SQL chứng minh điều này: `NO_PROFILE`, `SELF_APPROVAL`, `USE_BY_EXPIRED`, actor bị ghi đè đúng người gọi, tự nâng quyền thất bại.
- Mỗi thao tác là một giao dịch: lỗi ở bước nào cũng rollback sạch, audit cũng rollback theo.
- App không cầm khóa đặc quyền. Trên Vercel chỉ có 2 biến `NEXT_PUBLIC_*`.
- Audit cấu hình không thể "quên ghi".

**Xấu, phải chịu**
- **Luật bị viết hai lần**: TypeScript (gợi ý, hiển thị từng lô vi phạm gì) và PL/pgSQL (chốt). Có rủi ro hai bên lệch nhau. Giảm thiểu: quy ước "sửa luật = sửa cả hai + test cả hai" (ghi trong CLAUDE.md), unit test cho TS, test SQL cho DB, E2E đi xuyên cả hai.
- **Prototype mở hai khe hở chưa đóng.** (1) Cột cấu hình manager được UPDATE trực tiếp, nhưng DB không có CHECK cho `min_c <= max_c`, `near_expiry_days` 0–365 hay "window không quay về NULL". Các ràng buộc này chỉ kiểm ở BFF, nên manager gọi thẳng PostgREST là ghi được giá trị sai. (2) Policy `audit_insert` cho người có profile chèn dòng audit với `action`/`detail` tùy ý; trigger chỉ ghi đè đúng người thực hiện. Bản build: thêm CHECK/trigger cho cấu hình (đi kèm change request, ADR-004) và thu hồi INSERT `audit_logs` của `authenticated`.
- PL/pgSQL khó đọc, khó debug, ít người trong đội quen hơn TypeScript. Thông báo lỗi phải đi qua quy ước mã (`RAISE EXCEPTION 'CODE:detail'`) rồi ánh xạ sang tiếng Việt/Nhật ở BFF (`rpc-error-messages.ts`).
- `SECURITY DEFINER` là con dao hai lưỡi: một hàm viết sai (quên kiểm vai trò, `search_path` mở) thành lỗ hổng leo thang quyền. Bắt buộc review bảo mật mọi migration có `SECURITY DEFINER` và giữ test hồi quy.
- Migration là mã nguồn quan trọng nhất: đổi schema phải đổi cả hàm. Cần CI chạy `db:test` trên DB tạm cho mỗi PR (chưa có ở prototype).
- Khó unit test hàm SQL tách rời; test phải chạy trên Postgres thật (giao dịch rồi rollback).

## Kiểm chứng / xem xét lại khi

- `npm run db:test` xanh trên mỗi thay đổi migration.
- Xem xét lại nếu luật vượt khả năng biểu đạt hợp lý của SQL (ví dụ engine lập tuyến F06). Khi đó luật đó đặt ở service riêng, nhưng vẫn ghi DB qua RPC kiểm quyền.
