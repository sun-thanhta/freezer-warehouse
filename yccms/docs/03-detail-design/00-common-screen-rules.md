# Thiết kế chi tiết — Quy tắc chung cho mọi màn hình

Đặc tả từng màn chỉ ghi điểm riêng của màn đó. Mọi điểm dưới đây áp dụng chung, trừ khi đặc tả màn ghi khác.

## 1. Cấu trúc một bản đặc tả màn hình

Mỗi file `scr-*.md` gồm các mục:

1. **Thông tin chung**: mục đích, vai trò, URL, API, wireframe, yêu cầu RFP liên quan.
2. **Bảng phần tử**: cột `No.` khớp `[n]` trong wireframe.
3. **Validation**: chia 3 lớp (client · BFF · SQL) và nêu thông báo lỗi.
4. **Sự kiện / thao tác**: nút bấm → API → kết quả thành công / thất bại.
5. **Trạng thái**: trạng thái màn hình và trạng thái nghiệp vụ của đối tượng.
6. **Phân quyền**: vai trò × thao tác.
7. **[Prototype khác]**: điểm hệ thống đích khác prototype.

Cột "Kiểu" trong bảng phần tử: `label` (chữ chỉ đọc) · `text` · `number` · `date` · `select` · `radio-tab` · `button` · `link` · `badge` · `table` · `card` · `alert`.
Cột "Nguồn dữ liệu" ghi theo dạng `bảng.cột` hoặc `API → trường JSON`.

## 2. Trạng thái chung của màn hình

| Trạng thái | Khi nào | Hiển thị |
|---|---|---|
| `loading` | Lần tải đầu, chưa có dữ liệu | Khối nhấp nháy "Đang tải dữ liệu từ Supabase…" (đích: "読み込み中…"). Lần tải lại (sau thao tác) giữ dữ liệu cũ, không nháy màn |
| `error` | API trả lỗi | Hộp đỏ có thông báo từ trường `error` của API, kèm nút `[ Thử lại ]` (gọi lại API). **Ngoại lệ ở prototype** (hộp lỗi không có nút Thử lại): tạo phiếu nhập, chi tiết phiếu nhập, lịch sử giao theo khách, truy xuất. Bản đích thêm nút cho đồng bộ |
| `empty` | API thành công, danh sách rỗng | Chữ xám, nội dung ghi trong đặc tả từng màn |
| `ready` | Có dữ liệu | Nội dung đầy đủ |
| `submitting` | Đang gửi thao tác ghi | Nút đổi nhãn ("Đang lưu…", "Đang kiểm tra…") và bị khóa để chặn bấm hai lần |

## 3. Định dạng hiển thị

| Loại | Định dạng | Ví dụ | Ghi chú |
|---|---|---|---|
| Ngày | `yyyy/mm/dd` | 2026/10/03 | Kiểu Nhật, prototype đã dùng (`fmtDate`) |
| Ngày giờ | `yyyy/mm/dd HH:mm` theo JST (`ja-JP`, `Asia/Tokyo`) | 2026/10/03 09:31 | Lưu `timestamptz`; luôn đổi sang Asia/Tokyo khi hiển thị |
| "Hôm nay" nghiệp vụ | Ngày theo JST (`todayJst()`) | — | Không dùng giờ máy client hay UTC: lúc 00:00–09:00 JST, ngày UTC vẫn là hôm qua |
| Nhiệt độ | Giá trị như lưu (DB `numeric(5,1)`, tối đa 1 chữ số thập phân) + `°C` | -20°C · 3.5°C | |
| Khoảng ngưỡng | `min – max°C`, `≤ max°C`, `≥ min°C` | ≤ -18°C | Giá trị NULL = không giới hạn phía đó |
| Số lượng | Số nguyên, căn phải (`tabular-nums`) + đơn vị SKU | 24 cup | |
| Loại hạn | `賞味期限` / `消費期限`; viết tắt `賞味` / `消費` | — | `消費` luôn tô đỏ |
| Mã | Font monospace cho số lô, mã truy xuất | LOT-CHI002-A | |
| Delivery window | `1/3` · `1/2` · `Chỉ hạn trên nhãn` · `Chưa chốt → business-review` | — | |

## 4. Mã màu trạng thái (badge)

| Màu | Dùng cho |
|---|---|
| Đỏ | Bị chặn, hard stop (①②③⑤), 消費期限, lệch nhiệt, từ chối, quá hạn |
| Cam | Cảnh báo không chặn (④ window, cận hạn, hợp đồng chưa chốt, thiếu lô) |
| Tím | 隔離, chờ duyệt maker-checker, mốc 日付逆転, lane truy xuất pháp định |
| Xanh lá | Đạt, giao được, đã duyệt |
| Xanh dương | Thông tin, dải nhiệt, gợi ý FEFO |
| Xám | Trung tính, đã hủy |

Màu không phải tín hiệu duy nhất: mọi badge đều có chữ (WCAG 2.2 AA — đích).

## 5. Xử lý lỗi từ API

| HTTP | Hành vi client |
|---|---|
| 401 | Phiên hết hạn → chuyển `/login?next=<trang hiện tại>` |
| 403 / 404 / 409 / 422 | Hiện `error` (và `details.errors[]` nếu có, dạng danh sách) trong hộp đỏ ngay trên vùng thao tác. **Giữ nguyên dữ liệu người dùng đã nhập** |
| 500 | Hộp đỏ "… thất bại. Vui lòng thử lại." (server không trả chi tiết DB) |
| 503 | Hộp đỏ hướng dẫn "Resume project" (prototype) / "Hệ thống đang bảo trì" (đích) |
| Mất mạng | Như 503 |

Dạng body lỗi: `{ "error": "<thông báo>", "details": { "errors": ["…"], "reversals": [...] } }`.

## 6. Quy tắc nhập liệu chung

- Ô bắt buộc có thuộc tính `required`. Trình duyệt chặn gửi khi trống, nhưng BFF và SQL vẫn kiểm lại.
- Chuỗi được `trim()` trước khi kiểm và lưu. Chuỗi rỗng sau trim = không nhập.
- Ô số dùng `type=number`. Nhiệt độ `step=0.1`, số lượng `min=1` (số nguyên).
- Ngày dùng `type=date` (ISO `yyyy-mm-dd`). BFF kiểm `isIsoDate`: sai định dạng hoặc ngày không có thật (vd `2026-13-45`) → 422/400, không để lỗi 500.
- Id trên URL: số nguyên dương (`intParam`) hoặc UUID (`uuidParam`). Sai định dạng → 404.

## 7. Audit tự động

Mọi thao tác ghi **thành công** đều để lại bản ghi `audit_logs` do **database** ghi. Lượt bị chặn (日付逆転 / 消費期限) không vào `audit_logs` mà vào nhật ký `allocation_exceptions` (xem scr-05). Người dùng không cần làm gì, client không gửi người thực hiện.

| Thao tác | `action` |
|---|---|
| Xác nhận phiếu nhập | `inbound.confirm` |
| Giao hàng | `outbound.ship` |
| Đề nghị / duyệt / từ chối ngoại lệ | `override.request` / `override.approve` / `override.reject` |
| Release / scrap 隔離 | `quarantine.release` / `quarantine.scrap` |
| Sửa cấu hình | `temperature_zones.update` / `products.update` / `customer_sku_agreements.update` (chi tiết `before` / `after`) |

## 8. Bảng nhãn song ngữ (trích — dùng khi chuyển giao diện sang tiếng Nhật)

| Prototype (VN) | Đích (JP) |
|---|---|
| Tổng quan vận hành | 運用ダッシュボード |
| Phiếu nhập kho / Tạo & kiểm phiếu nhập | 入荷一覧 / 入荷検品 |
| Đạt / Từ chối / 保留 → 隔離 | 受入 / 拒否 / 保留（隔離） |
| Tồn kho đa tiêu chí | 在庫照会 |
| Đơn xuất kho / Allocation | 出荷指示一覧 / 引当 |
| Kiểm tra & xác nhận giao | 出荷前検品・出荷確定 |
| Cảnh báo 日付逆転 | 日付逆転アラート |
| Đề nghị ngoại lệ / Duyệt / Từ chối | 例外申請 / 承認 / 却下 |
| Hợp đồng khách-SKU | 顧客×SKU 契約 |
| Ngưỡng nhiệt | 温度帯しきい値 |
| Truy xuất xuôi / ngược | 正方向トレース / 逆方向トレース |
| Audit log | 監査ログ |
