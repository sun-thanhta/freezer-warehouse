# ADR-002 — Route Handler của Next.js làm BFF; trình duyệt không truy vấn bảng trực tiếp

- **Trạng thái:** Đã chấp nhận, đã cài (`src/app/api/**`, `src/lib/api/api-route-helpers.ts`, `src/lib/client/use-api.ts`)
- **Ngày:** 2026-10-03
- **Liên quan:** ADR-001, ADR-005 · yêu cầu "frontend → Next.js API routes → Supabase thật"

## Bối cảnh

- Màn xuất kho cần **gộp** dữ liệu từ 5 nguồn: đơn + dòng, lô còn tồn, hợp đồng khách-SKU, mốc 日付逆転 (`last_deliveries`), đề nghị đang chờ. Sau đó chạy chuỗi loại trừ ①→⑤ và gợi ý FEFO. Cùng logic đó dùng lại ở màn cảnh báo, dashboard và API giao hàng.
- Thông báo lỗi phải là tiếng người (Việt/Nhật) theo mã nghiệp vụ. Không được lộ nội dung lỗi Postgres ra trình duyệt.
- Cần cổng đăng nhập cho **cả trang lẫn API**. Người lạ không được thấy nội dung, kể cả khi gọi API trực tiếp.
- Next.js 16 có nhiều cách lấy dữ liệu: Server Components, Server Actions, Route Handlers, hoặc supabase-js chạy ở client.

## Quyết định

1. Trang là **client component**, lấy dữ liệu bằng `fetch('/api/…')` qua hook `useApi` (giữ dữ liệu cũ khi tải lại; 401 → về `/login?next=`).
2. Mỗi màn có một (hoặc vài) **Route Handler** trả JSON đã gộp sẵn cho màn đó. Mỗi route bọc `withAuth`: lấy phiên từ cookie → đọc `profiles` → 401/403/503 → gọi handler → đổi lỗi thành JSON chuẩn.
3. Route Handler gọi Supabase bằng **JWT của chính người dùng** (server client của `@supabase/ssr`), không dùng service role. Quyền cuối cùng vẫn do RLS/RPC quyết định (ADR-001).
4. Logic dùng chung nằm ở `src/lib/services/` (pick-plan, kiểm phiếu nhập, kiểm giao hàng) và `src/lib/rules/` (hàm thuần, không I/O; client và server dùng chung được).
5. Trình duyệt chỉ dùng supabase-js cho **đăng nhập / đăng xuất**.
6. `src/proxy.ts` chặn trang khi chưa có phiên. Matcher **bỏ qua `api/`** vì API tự trả 401 dạng JSON, không chuyển hướng HTML.

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| **A. supabase-js gọi bảng trực tiếp từ trình duyệt (dựa hoàn toàn vào RLS)** | Logic gộp nhiều bảng + chuỗi loại trừ phải chạy ở client, nên mọi màn tự lặp lại hoặc phải chuyển cả pick-plan xuống client. Cấu trúc bảng lộ ra client, đổi schema là vỡ UI. Thông báo lỗi DB lộ thẳng ra. Không đáp ứng yêu cầu đề bài "Next.js API routes gọi Supabase" |
| **B. Server Components đọc DB, Server Actions để ghi** | Hợp với trang tĩnh nhiều hơn màn thao tác dày như allocation (người dùng sửa số lượng từng lô, tải lại kế hoạch sau khi giao). Server Actions không có hợp đồng HTTP rõ ràng, nên khó test bằng curl/E2E, khó tái dùng cho thiết bị khác (handy terminal, app tài xế) và cho tích hợp sau này. Next 16 còn đổi nhiều API (`proxy`, `params` là Promise); dùng ít bề mặt framework thì giảm rủi ro nâng cấp |
| **C. GraphQL (pg_graphql) hoặc PostgREST thô làm "API"** | Như A: logic nghiệp vụ không có chỗ đứng; client phải tự ghép |
| **D. API riêng (Express/Nest) tách khỏi Next.js** | Thêm một deploy/dịch vụ. Với 80 người dùng thì Route Handler trên Vercel là đủ |

## Hệ quả

**Tốt**
- Mỗi màn có một hợp đồng JSON rõ (xem `03-detail-design/api-specification.md`): test được bằng curl, Playwright, và tái dùng được cho handy terminal/app tài xế sau này.
- Một engine pick-plan cho 4 nơi dùng, nên số liệu dashboard, danh sách, cảnh báo luôn khớp nhau.
- Lỗi DB được ánh xạ sang mã nghiệp vụ, không lộ nội dung thô. Mất kết nối (project pause) có thông báo riêng (503).
- Cổng đăng nhập 2 lớp (proxy cho trang, `withAuth` cho API) đã kiểm trên production: trang bị chuyển về `/login` (curl: 307), API trả 401.

**Xấu, phải chịu**
- **Thêm một bước mạng**: trình duyệt → Vercel → Supabase. Nếu Vercel và Supabase khác vùng thì mỗi request tốn thêm vài trăm ms. Bản đích phải ghim Vercel ở `hnd1` cùng vùng Tokyo với Supabase (prototype chưa ghim).
- Trang client không có SSR dữ liệu: lần đầu thấy "Đang tải…" rồi mới có nội dung. Chấp nhận được cho app nội bộ sau đăng nhập, không cần SEO.
- Mỗi request API gọi `auth.getUser()` + đọc `profiles` (2 lượt tới Supabase) trước khi làm việc thật. Có thể giảm bằng cách xác minh JWT cục bộ (JWKS) và cache vai trò trong claim. Để dành cho lúc tối ưu hiệu năng.
- Serverless function có giới hạn thời gian chạy và cold start. Tác vụ dài (import ERP, xuất báo cáo lớn) **không** đặt ở Route Handler mà ở job runner (đã giữ chỗ trong kiến trúc).
- Kiểu dữ liệu giữa route và trang khai báo tay (interface ở trang), có thể lệch nhau. Đích: chia sẻ type từ `src/lib/services/*-types.ts` hoặc sinh type từ schema.

## Kiểm chứng / xem xét lại khi

- p95 đo bằng load test 80 user vượt ngưỡng (đọc 2s / ghi 3s): xem lại số lượt gọi Auth mỗi request, cache, hoặc chuyển màn đọc nặng sang hàm SQL tổng hợp.
- Có client thứ hai (thiết bị tài xế): giữ BFF, thêm route theo thiết bị, không cho thiết bị gọi DB trực tiếp.
