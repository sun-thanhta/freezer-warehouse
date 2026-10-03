# ADR-006 — Giai đoạn đầu chỉ chạy local: Supabase CLI trên Docker, hoãn cloud

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-10-03
- **Liên quan:** ADR-005 (đích vẫn là Supabase + Vercel), ADR-001

## Bối cảnh

- Dự án thật bắt đầu từ thư mục `yccms/`, cùng stack với prototype (Next.js 16 + Supabase). Chủ dự án quyết định **tạm bỏ phần cloud** (Supabase cloud, Vercel); trước mắt chỉ cần chạy ở máy local.
- Prototype đã từng phải chạy E2E không có cloud, bằng Postgres 14 + PostgREST + gateway giả lập GoTrue tự viết (ghi ở CLAUDE.md gốc). Cách đó lệch so với Supabase thật: PG14 không có `security_invoker`, stub `auth.uid()`, phải tự xử lý CORS.
- Máy dev có Colima (Docker runtime) và đủ tài nguyên (16 GB RAM).

## Quyết định

- Dùng **Supabase CLI** (cài làm devDependency, gọi qua `npx supabase`) chạy stack Supabase trong Docker: Postgres 17 (cùng bản với cloud), GoTrue, PostgREST, Kong, Studio, Mailpit.
- Tắt dịch vụ chưa dùng trong `supabase/config.toml` (realtime, storage, edge functions, analytics) để giảm RAM và thời gian khởi động.
- `.env.local` **sinh từ stack đang chạy** (`npm run env:local`), không chép tay khóa.
- Migration dạng `supabase/migrations/<timestamp>_<tên>.sql`, áp bằng `supabase db reset`. Test SQL bằng **pgTAP** (`supabase test db`).
- Tài khoản dev tạo bằng script dùng Admin API; script từ chối chạy với URL không phải local.
- **Chỉ nghe trên `127.0.0.1`.** `next dev`/`next start` chạy với `-H 127.0.0.1`. Supabase CLI luôn publish cổng ra `0.0.0.0` và Colima mặc định forward ra `0.0.0.0` của máy thật, nên mỗi máy dev thêm `~/.colima/_lima/_config/override.yaml` (mẫu `scripts/colima-localhost-only.yaml`) để forward về `127.0.0.1`. Đã kiểm: từ IP LAN cả 5 cổng (3000, 54321–54324) đều đóng.

## Phương án đã bỏ

| Phương án | Vì sao bỏ |
|---|---|
| Dùng luôn Supabase cloud (project dev) | Trái quyết định của chủ dự án ở giai đoạn này; phụ thuộc mạng; gói Free tự pause |
| Postgres Homebrew + PostgREST + gateway giả lập (như prototype offline) | Không phải Supabase thật: lệch phiên bản PG, phải stub `auth.uid()` và tự làm CORS; lỗi tìm được ở đây chưa chắc là lỗi thật và ngược lại |
| Bỏ Supabase, app nối thẳng Postgres bằng `pg` | Đổi kiến trúc (mất RLS theo JWT người dùng, ADR-001/002); lên cloud sau sẽ phải viết lại |
| Docker Compose tự viết các image Supabase | Tự duy trì cấu hình mà CLI đã lo sẵn; dễ lệch phiên bản |

## Hệ quả

**Tốt**
- Môi trường dev giống cloud nhất có thể (cùng Postgres 17, GoTrue, PostgREST), nên lên cloud ở P5 chỉ còn là việc cấu hình và CI, không phải đổi code.
- `npm run db:reset` dựng lại DB sạch trong vài giây; test pgTAP chạy trên đúng engine thật.
- Không có bí mật cloud nào trong máy dev hay repo.

**Xấu, phải chịu**
- Mỗi dev phải có Docker runtime và khoảng 4 GB RAM trống cho VM; lần đầu tải khoảng 3 GB image.
- macOS + Colima có vài bẫy, đã ghi trong hướng dẫn: phải `brew link docker`; thư mục `supabase/snippets` phải có sẵn; cờ `[auth.email] enable_signup` tắt cả đăng nhập email.
- Chưa kiểm được những gì chỉ cloud có: PITR, SLA, độ trễ thật giữa Vercel và Supabase, giới hạn gói, SSO SAML. Các rủi ro của ADR-005 vẫn còn nguyên, chỉ bị đẩy sang P5.
- Chưa có CI: kiểm tra chạy tay trên máy dev cho tới khi dựng pipeline.
- Việc khóa cổng Supabase phụ thuộc file cấu hình **máy** (ngoài repo). Máy dev nào quên tạo file thì Postgres (`postgres`/`postgres`) và Studio mở ra mạng LAN; phải kiểm bằng `lsof` theo hướng dẫn. File này cũng áp cho mọi project Docker khác trên Colima của máy đó.
- Đã thử và bỏ các cách khác: `ip` của Docker daemon (Supabase CLI chỉ định `0.0.0.0` nên không ăn), biến `SUPABASE_SERVICES_HOSTNAME` (không đổi địa chỉ bind), bộ forward `grpc` (vẫn mở `0.0.0.0`), `network.hostAddresses` của Colima (chỉ dùng khi container bind IP cụ thể).

## Xem xét lại khi

- Cần cho khách/UAT truy cập, hoặc cần đo hiệu năng (NFR-PERF): chuyển sang P5 (cloud), giữ local cho dev.
