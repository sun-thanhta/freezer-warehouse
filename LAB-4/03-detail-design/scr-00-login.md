# SCR-00 — Đăng nhập

## 1. Thông tin chung

| Mục | Nội dung |
|---|---|
| Mục đích | Cổng vào duy nhất. Người chưa đăng nhập mở URL nào cũng bị đưa về đây (NFR-SEC-01, yêu cầu "người lạ không xem được nội dung") |
| URL | `/login` · tham số `?next=<đường dẫn>` · `?error=config\|db` |
| Vai trò | Mọi người dùng |
| API | Supabase Auth `signInWithPassword` (từ trình duyệt); không qua `/api/*` |
| Wireframe | [WF-00](../02-wireframes/wireframe-01-layout-login-dashboard.md#wf-00--đăng-nhập-scr-00) |

## 2. Bảng phần tử

| No. | Tên | Kiểu | Bắt buộc | Định dạng / giới hạn | Mặc định | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | Email | text (`type=email`) | ✓ | Định dạng email (trình duyệt kiểm); `autocomplete=username` | trống | |
| 2 | Mật khẩu | text (`type=password`) | ✓ | `autocomplete=current-password` | trống | Không hiện chữ |
| 3 | Hộp lỗi | alert (`role=alert`) | — | — | ẩn; hiện sẵn nếu URL có `?error=` | Xem mục 3 |
| 4 | Đăng nhập | button submit | — | Khi gửi: nhãn "Đang đăng nhập…", bị khóa | — | |
| 5 | Ghi chú tài khoản demo | label | — | — | — | **[Prototype khác]** chỉ có ở prototype, bản đích bỏ |

## 3. Validation và thông báo

| Điều kiện | Lớp | Thông báo |
|---|---|---|
| Email/mật khẩu trống | Trình duyệt | Thông báo mặc định của trình duyệt |
| Sai thông tin (`Invalid login credentials`) | Supabase Auth | "Sai email hoặc mật khẩu." |
| Không kết nối được Supabase (project pause, mạng) | Auth client | "Không kết nối được database Supabase. Nếu project đang tạm dừng (paused), vào Supabase Dashboard và bấm "Resume project", đợi 1–2 phút rồi tải lại trang." |
| `?error=config` | proxy | "Ứng dụng chưa được cấu hình Supabase (thiếu biến môi trường)." |
| `?error=db` | proxy | Như dòng "không kết nối được" |
| Lỗi khác từ Auth | Auth | Hiện nguyên thông báo của Auth |

Không có giới hạn số lần thử ở tầng ứng dụng; dùng rate limit mặc định của Supabase Auth.

## 4. Sự kiện

| Sự kiện | Xử lý | Thành công | Thất bại |
|---|---|---|---|
| Bấm [4] | `signInWithPassword({email, password})` | Đi tới `next` nếu `next` bắt đầu bằng `/` và không bắt đầu bằng `//`, nếu không thì về `/`; `router.refresh()` để proxy đọc cookie mới | Hiện [3], giữ email đã nhập, xóa trạng thái bận |
| Mở `/login` khi đã có phiên | proxy | 307 → `/` | — |
| Mở trang bất kỳ khi chưa có phiên | proxy | 307 → `/login?next=<path>` (bỏ `next` nếu path là `/`). Chỉ giữ **pathname**: `/inventory?view=quarantine` đăng nhập xong về `/inventory` (đích: giữ cả query) | — |

## 5. Trạng thái

`idle` → `submitting` → (`idle` + lỗi) | chuyển trang.

## 6. Phân quyền

Ai cũng mở được. Đăng nhập được nhưng chưa có bản ghi `profiles` thì vào trang được (proxy chỉ kiểm phiên), còn mọi API đều trả **403** "Tài khoản chưa được cấp quyền (thiếu bản ghi profiles)". Đăng ký mới được tắt bằng tay trên Supabase Dashboard (Authentication → "Allow new users to sign up" = off). Cấu hình này không nằm trong repo, nên khi dựng môi trường mới phải tắt lại. Tài khoản chỉ do admin tạo.

## 7. [Prototype khác]

| Prototype | Hệ thống đích |
|---|---|
| Email + mật khẩu Supabase; 2 tài khoản demo tạo bằng script `db:setup` | SSO OIDC/SAML với IdP Yuki (IF-IDP-01); MFA bắt buộc cho `manager`, `qa`, `admin`; tài xế dùng thiết bị quản lý |
| Không ghi event đăng nhập vào `audit_logs` | Ghi `auth.login` / `auth.logout` / `auth.failed` (NFR-AUD-01); dùng auth hook của Supabase hoặc đọc log Auth |
| Có user mà không có profile thì vào trang được (API trả 403) | Sau đăng nhập kiểm profile; thiếu thì hiện màn "Chưa được cấp quyền" thay vì trang trống |
