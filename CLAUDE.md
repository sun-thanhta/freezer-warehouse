# CLAUDE.md — freezer-warehouse (YCCMS)

Repo cho dự án đề xuất **Yuki Cold-Chain Management System (YCCMS)** — chuỗi kho lạnh thực phẩm 3 dải nhiệt của Công ty CP Logistics Lạnh Yuki (khách hư cấu). Vendor: Sun VN02. Ngôn ngữ làm việc: tiếng Việt, giữ nguyên thuật ngữ nghiệp vụ Nhật.

## Cấu trúc repo

| Thư mục | Nội dung | Ghi chú |
|---|---|---|
| `LAB-1/` | Gói đề xuất v2 theo RFP thật: `product-b-rfp-ja-v2.0-rc4.pdf` (RFP gốc, tiếng Nhật), `Yuki_00_Trich-yeu-cau-RFP_v2.docx`, `Yuki_Workbook_v2-RFP.xlsx` (12 function · 47 feature · 41 màn hình · 12 user story · 88 yêu cầu), proposal, quick report | **Chỉ đọc** — là đầu vào nghiệp vụ |
| `Claude outputs/` | Bản v1 cũ (`Yuki_Estimation-Workbook.xlsx`, `Yuki_00_Bo-tai-lieu-khach_INPUT.docx`, proposal/quick report v1) và bản sao v2 | **Chỉ tham khảo**, đã bị thay thế — không lấy số liệu từ đây |
| `yccms/` | **Dự án thật (bản build)**: Next.js 16 + Supabase, hiện chỉ chạy local (Supabase CLI trên Docker/Colima) | Có `README.md`, `CLAUDE.md`, `docs/` riêng (dựng từ LAB-4, là bản sống). Làm theo thiết kế, không theo prototype |
| `yccms-prototype/` | Prototype MVP chạy được: Next.js 16 + Supabase + Vercel | Bản demo đã nộp; chỉ tham khảo khi build `yccms/` |
| `LAB-4/` | Bộ thiết kế cơ bản + chi tiết dựng từ prototype: `01-basic-design/` (tổng quan, kiến trúc, màn hình/phân quyền), `02-wireframes/`, `03-detail-design/` (đặc tả màn, API, luật & mã lỗi), `04-adr/`, `05-database/` (ER đích + đối chiếu schema thật) | Mô tả **hệ thống đích**; chỗ khác prototype ghi `[Prototype khác]`. Sửa code/schema prototype thì cập nhật bảng đối chiếu `05-database/02-…` |
| `LAB-3/` | Đề xuất upsell sau MVP (`.docx`) | Chỉ đọc |
| `yccms-prototype/docs/` | Tài liệu dạng `.md`, chia folder `01-scope/`, `02-technical/`, `03-demo/`, `04-reports/` | Tài liệu mới luôn đặt vào đúng folder, đặt tên kebab-case |
| `plans/` | Plan nội bộ của Takumi (bị gitignore) | |
| `.claude/` | Takumi kit (agents, skills, rules) | Không sửa trừ khi được yêu cầu; `.claude/.tkm.json` có `takumi.sddMode: off` |

## Lệnh thường dùng (chạy trong `yccms-prototype/`)

```bash
npm run dev          # dev server (cần .env.local)
npm run build        # build production
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest — unit test luật nghiệp vụ (src/lib/rules)
npm run db:setup     # áp schema + RPC, nạp mock, tạo 2 tài khoản demo (cần SUPABASE_SECRET_KEY + SUPABASE_DB_URL)
npm run db:seed      # chỉ nạp lại dữ liệu mock (reset demo)
npm run db:test      # test hồi quy bảo mật SQL (supabase/tests, tự rollback; cần dữ liệu vừa seed)
npm run test:e2e     # Playwright E2E (e2e/), E2E_BASE_URL mặc định http://localhost:3000; làm bẩn dữ liệu → db:seed sau đó
```

Node ≥ 20.12 (repo dùng 22.23.1, xem `.node-version`). Env mẫu: `yccms-prototype/.env.example`. Không bao giờ commit `.env.local`, không đưa service role key lên Vercel hay xuống client.

## Kiến trúc prototype

- **Next.js 16 khác bản cũ:** middleware đổi tên thành `src/proxy.ts`; `params` của route/page là Promise; đọc `yccms-prototype/node_modules/next/dist/docs/` trước khi dùng API Next lạ (xem `yccms-prototype/AGENTS.md`).
- **Cổng đăng nhập:** `src/proxy.ts` chuyển mọi trang (trừ `/login`) về `/login` khi chưa có session; mọi API route bọc `withAuth()` (`src/lib/api/api-route-helpers.ts`) → 401 chưa đăng nhập, 403 thiếu `profiles`, 503 khi DB không tới được (thông báo "Resume project").
- **Luồng dữ liệu:** trang client → `fetch('/api/...')` (`src/lib/client/use-api.ts`) → Route Handler → Supabase bằng JWT người dùng (RLS `authenticated`). Không hard-code dữ liệu nghiệp vụ trong code; dữ liệu nằm ở bảng Supabase, nạp từ `supabase/seed/`.
- **RLS** (`supabase/migrations/0002_row_level_security.sql`): đọc cần có `profiles` (`app_role()`); insert/update/delete bị thu hồi trên mọi bảng, chỉ mở hẹp: manager sửa đúng các cột cấu hình (grant theo cột, gồm `customer_sku_agreements.window_rule`); ghi lượt `blocked` vào `allocation_exceptions` và audit — trigger `stamp_actor` / `verify_blocked_exception` đóng dấu người thực hiện và tự tính lại nội dung; ràng buộc `allocation_exceptions_once` (rule × đơn × lô × quyết định) chỉ giữ 1 lượt; trigger `audit_config_change` tự ghi audit (trước → sau) mọi sửa cấu hình trên `temperature_zones` / `products` / `customer_sku_agreements`. `profiles` chỉ đọc (script setup dùng quyền owner). Đừng mở lại quyền ghi trực tiếp cho `authenticated`.
- **Ghi nghiệp vụ = 1 giao dịch SQL:** `confirm_inbound_receipt`, `resolve_quarantine` (`0003_inbound_functions.sql`); `confirm_shipment`, `request_override`, `decide_override` (`0004_outbound_functions.sql`, dùng chung `_validate_shipment` / `_perform_shipment` — không cấp execute cho người dùng). Tất cả `SECURITY DEFINER` + `search_path = public, pg_temp`, tự kiểm `auth.uid()` + `profiles` + luật; snapshot mốc 日付逆転 trước vòng lặp, advisory lock theo khách × SKU; giao xong thì đề nghị ngoại lệ còn chờ của đơn đó chuyển `cancelled` (mỗi đơn tối đa 1 đề nghị `pending`); `confirm_inbound_receipt` chỉ nhận `arrival_date` từ 7 ngày trước đến hôm nay (JST). Sửa SQL bảo mật thì chạy `npm run db:test` (cần dữ liệu vừa seed).
- **Luật nghiệp vụ thuần** ở `src/lib/rules/` (FIFO/FEFO, 日付逆転, 1/3–1/2, ngưỡng nhiệt) có unit test `business-rules.test.ts`; `src/lib/services/pick-plan-service.ts` dựng kế hoạch lấy hàng dùng chung cho màn xuất kho, cảnh báo, dashboard, API giao hàng. Sửa luật thì sửa cả TS **và** guard SQL tương ứng.
- Vai trò: `warehouse`, `manager`. Manager duyệt đề nghị ngoại lệ 日付逆転 của **người khác**, chốt delivery window, sửa `/settings`, release/scrap 隔離.

## Bẫy nghiệp vụ Nhật — KHÔNG được làm sai (nguồn: LAB-1 **bản v2** theo RFP `YCL-RFP-2026-01 v2.0`)

`LAB-1/` chỉ giữ bộ v2 (`*_v2*`, `product-b-rfp-ja-v2.0-rc4.pdf`) — **bản chính**. Bản v1 (`Yuki_Estimation-Workbook.xlsx`, `Yuki_00_Bo-tai-lieu-khach_INPUT.docx`, nằm ở `Claude outputs/`) dựng trên giả định, đã bị thay thế — đừng lấy số liệu v1.

1. **Chuỗi loại trừ allocation FR-OUT-02, đúng thứ tự:** ① 消費期限 đến/quá (hạn ≤ ngày giao; đơn giao trễ thì lấy hôm nay, giờ JST) = HARD STOP + ghi exception bất biến → ② lô nằm sai dải nhiệt → ③ đang 隔離 → ④ vi phạm delivery window → ⑤ 日付逆転 → còn lại FEFO, cùng hạn thì FIFO. TS (`src/lib/rules/allocation-chain-rules.ts`) và SQL (`_validate_shipment`) phải khớp nhau.
2. **日付逆転禁止 (BR-DATE-01):** so với hạn lớn nhất đã giao cho **đúng cặp khách-SKU**; không so hôm nay; không mượn lịch sử khách khác (CUS-004/CUS-005 không bị ảnh hưởng bởi lịch sử CUS-003). Ngoại lệ chỉ qua maker-checker: người lập đề nghị ≠ người duyệt (NFR-SEC-02).
3. **Delivery window (BR-DELWIN-01)** theo **hợp đồng khách × SKU** (`customer_sku_agreements`, R-04): ONE_THIRD / ONE_HALF / LABEL_DATE_ONLY — tập quán thương mại, **không phải luật**; vi phạm loại khỏi gợi ý nhưng chọn tay chỉ cảnh báo. AGR-008 / AGR-014 chưa chốt (NULL) → business-review, **không bao giờ tự áp mặc định**.
4. **賞味期限 = cảnh báo, 消費期限 = hard stop** (BR-EXP-01/02), khai theo SKU.
5. **Ngưỡng 3 dải nhiệt do Yuki tự công bố:** 常温 15–25°C · 冷蔵 **0–5°C** · 冷凍 ≤ −18°C — đọc từ `temperature_zones`, không viết cứng. Lệch nhiệt khi nhận → chỉ Từ chối hoặc 保留 vào khu 隔離 (-Q: C-Q, F-Q; 常温 không có -Q).
6. **Truy xuất 3 lane:** gạo AMB-001 (産地・取引) và bò CHI-001 (mã cá thể **đúng 10 số**; 9 số → business-review, không tự làm tròn) là pháp định; còn lại `internal_lot`.
7. Dữ liệu demo dùng đúng fixture RFP: 12 SKU AMB/CHI/FRO-001…004, khách CUS-001…005, 15 hợp đồng AGR-001…015.
8. Lập tuyến + giờ lái 2024, logger/HACCP, recall, POD **nằm ngoài phạm vi prototype** (xem `docs/01-scope/`).

## Kiểm thử không cần Supabase cloud

`yccms/` dùng Supabase CLI chạy local trên Docker (Colima): xem `yccms/docs/00-development/local-development-setup.md`. Phần dưới đây là cách cũ của prototype, khi đó máy chưa dùng Docker.

Khi dựng prototype, máy dev không có Docker. Cách đã dùng để chạy E2E offline: Postgres 14 local + PostgREST 16.4 (binary từ GitHub release) + gateway Node giả lập GoTrue và `/rest/v1`. Postgres 14 local không có `security_invoker` cho view (Supabase PG15+ có) → dùng hàm SQL thay view. Stub `auth.uid()` phải đọc cả `request.jwt.claim.sub` lẫn `request.jwt.claims` (PostgREST ≥ 12 chỉ đặt cái sau). Gateway giả lập phải trả header CORS + xử lý preflight OPTIONS, nếu không đăng nhập trên trình duyệt sẽ treo. Script giả lập không nằm trong repo; khi cần thì dựng lại theo mô tả này.

## Quy ước

- File code < 200 dòng, tên kebab-case mô tả rõ mục đích.
- UI tiếng Việt + thuật ngữ Nhật; tài liệu `.md` tiếng Việt tự nhiên, ít từ tiếng Anh.
- Commit theo conventional commits, không nhắc tới AI trong message.
- Supabase: project `upngghuyjvwhlxaqqqml` (Tokyo). Biến công khai là `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (code vẫn nhận `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Vercel: <https://yccms-prototype.vercel.app> (project `yccms-prototype`, deploy bằng `npx vercel deploy --prod` trong `yccms-prototype/`; `.vercelignore` chặn upload `.env*`). Chỉ 2 biến `NEXT_PUBLIC_*` nằm trên Vercel.
