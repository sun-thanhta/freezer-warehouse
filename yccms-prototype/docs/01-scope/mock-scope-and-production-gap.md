# Phần nào là mock — và nếu làm thật thì cần gì

Prototype chạy thật: trình duyệt → Next.js API route → Supabase (Postgres + Auth). Không có dữ liệu nghiệp vụ nào viết cứng trong code. Những phần dưới đây là **giả lập có chủ đích** để kịp demo.

## 1. Bảng tổng hợp

| # | Phần đã mock / rút gọn | Trong prototype hiện tại | Nếu làm thật cần gì |
|---|---|---|---|
| 1 | **Dữ liệu** | Bộ mock (`supabase/seed/seed-mock-data.sql`) dựng từ fixture RFP: 12 SKU (R-02), 5 khách CUS-001…005, 15 hợp đồng AGR (R-04), bố trí kho + khu 隔離 (R-01); 5 NCC, 19 lô, 6 lần giao lịch sử, 5 đơn chờ xuất là hư cấu. Ngày tính tương đối theo hôm nay | Migration có lineage, 2 lần rehearsal, xử lý dirty data ACCEPT/REJECT/DUPLICATE/BUSINESS-REVIEW (DR-MIG-01). **Lịch sử giao là bắt buộc** — thiếu nó thì 日付逆転 vô nghĩa |
| 2 | **Đăng nhập** | Supabase Auth email/mật khẩu, 2 tài khoản demo | SSO/OIDC qua IdP của Yuki (IF-IDP-01 — còn là Assumption), MFA cho vai trò đặc quyền, thiết bị quản lý cho tài xế (NFR-SEC-01) |
| 3 | **Phân quyền** | 2 vai trò `warehouse` / `manager`. RLS: chỉ người có hồ sơ mới đọc được; người dùng app **không ghi thẳng** bảng nghiệp vụ — mọi thao tác ghi đi qua hàm SQL tự kiểm vai trò; quản lý chỉ sửa đúng các cột cấu hình | RBAC theo 7 nhóm nhân sự (kho, tài xế, 配車計画, QA, sales/CS, IT, admin), phân quyền xem dữ liệu nhạy cảm |
| 4 | **Maker-checker** | Áp cho ngoại lệ 日付逆転: người đề nghị ghi lý do, **quản lý khác** duyệt mới giao được | Áp cho mọi thay đổi master/hợp đồng (DR-MST-01, SCR-05), có hạn duyệt và thông báo |
| 5 | **Đơn xuất** | Đơn có sẵn trong DB | Nhận đơn từ ERP qua SFTP CSV có schema version + idempotency (IF-ERP-01 — Assumption), xử lý lỗi master/trùng (FR-OUT-01) |
| 6 | **Delivery window** | ONE_THIRD / ONE_HALF / LABEL_DATE_ONLY theo hợp đồng; 納品期限 = NSX + ⌊hạn × tỉ lệ⌋; dòng chưa chốt hiện "business-review" | Hợp đồng có hiệu lực theo ngày (nhiều phiên bản); quy tắc làm tròn theo hợp đồng; xác nhận cách tính với Yuki |
| 7 | **日付逆転** | So theo cặp khách × SKU với **hạn lớn nhất** đã giao (chặt hơn "lần giao gần nhất"); không bao giờ so với hôm nay | Xác nhận với Yuki: "最後に受け入れた配送" hiểu theo cách nào; theo khách hay **từng cửa hàng**; xử lý giao hàng bị trả về |
| 8 | **Ngưỡng nhiệt** | 1 giá trị hiện hành / dải (常温 15–25, 冷蔵 0–5, 冷凍 ≤ −18); audit ghi trước → sau | Ngưỡng có phiên bản theo ngày hiệu lực (BR-TEMP-01) để đánh giá lại đúng ngưỡng tại thời điểm đo |
| 9 | **Ghi nhiệt khi xuất** | 1 giá trị/đơn, đo ở dải lạnh nhất của đơn; kiểm ở cả API và hàm SQL | Ghi theo từng khoang xe/dải nhiệt + seal + giờ (FR-OUT-05); deviation case khi lệch |
| 10 | **Truy xuất** | 1 mã/lô: gạo 産地・取引 (chuỗi tự do), bò mã 10 số (kiểm định dạng; 9 số bị chặn nhận, chưa có luồng 保留 business-review) | Đối chiếu mã cá thể bò với cơ sở dữ liệu quốc gia; tách trường 産地 và 取引 cho gạo; recall + đối soát số lượng (FR-TRC-02) |
| 11 | **Kiểm nhập** | Nhiệt, lô, NSX, hạn, số lượng, vị trí, mã truy xuất; ngày nhận chỉ trong 7 ngày gần nhất (không lùi/tiến ngày quanh kiểm 消費期限) | Ảnh chụp có hash, appointment + cảnh báo trùng tham chiếu NCC, idempotency khi gửi lại (FR-REC-01/04) |
| 12 | **隔離** | Chuyển lô vào vị trí -Q khi nhận; quản lý release/scrap có lý do; chưa có chiều "đang tồn → 隔離" khi QA phát hiện sau | QA disposition đầy đủ (FIG-011), đo lại nhiệt, deviation case liên kết |
| 13 | **Tích hợp bên thứ ba** | Không có: ERP, logger CSV, mapping service, mail relay, máy quét, máy in nhãn | Adapter theo IF-ERP-01 / FR-TEMP-01 / IF-MAP-01 / IF-MAIL-01; thiết bị theo khảo sát hiện trường |
| 14 | **Lập tuyến & giờ lái, HACCP, recall, POD, báo cáo** | Không dựng (xem danh sách ngoài phạm vi) | Theo WBS trong workbook v2 |
| 15 | **Ngôn ngữ** | Tiếng Việt + thuật ngữ Nhật; tên SKU/khách giữ tiếng Nhật | Giao diện tiếng Nhật, giờ JST (NFR-LOC-01), WCAG 2.2 AA |
| 16 | **Hạ tầng** | Supabase Free (tự pause sau ~7 ngày không dùng), Vercel Hobby | Vùng Tokyo, AVL 99.5%, RTO 4h / RPO 15′, giám sát, kiểm thử tải 80 người dùng + 300.000 dòng (NFR-PERF/BCP) |
| 17 | **Quy mô đọc** | Truy vấn lô dùng API mặc định (giới hạn 1.000 dòng) — đủ cho dữ liệu mock | Phân trang/tổng hợp trong SQL cho dữ liệu thật |

## 2. Phần KHÔNG mock (chạy thật)

- Đăng nhập Supabase Auth; trang và API đều chặn người chưa đăng nhập (proxy + kiểm tra session ở từng route → 401).
- Mọi màn đọc dữ liệu qua `/api/*` → Supabase. Mọi thao tác ghi là ghi thật, **mỗi thao tác là 1 giao dịch SQL**:
  - Kiểm nhập → `confirm_inbound_receipt` kiểm lại nhiệt / ghi chú / mã gạo-bò / vị trí đúng dải, ghi phiếu + dòng + lô (lô 保留 vào 隔離) + audit.
  - Giao hàng → `confirm_shipment` khóa đơn + lô + cặp khách × SKU, chạy lại chuỗi ①②③⑤ trong SQL (④ delivery window chỉ kiểm ở app — chọn tay chỉ cảnh báo), trừ tồn, ghi lịch sử giao, đóng đơn. ① so hạn lô với max(ngày giao dự kiến, hôm nay JST) nên đơn giao trễ vẫn bị chặn đúng.
  - Ngoại lệ 日付逆転 → `request_override` (người lập) rồi `decide_override` (quản lý khác người lập) → giao + ghi nhật ký bất biến; mỗi đơn chỉ có 1 đề nghị chờ duyệt, đề nghị khác còn treo sẽ thành `cancelled` khi đơn đã giao.
  - 隔離 → `resolve_quarantine` (release/scrap).
- Gọi thẳng API Supabase bằng anon key + JWT cũng không lách được: thiếu hồ sơ → `NO_PROFILE`; tự duyệt → `SELF_APPROVAL`; 消費期限 → `USE_BY_EXPIRED`; nhật ký do server đóng dấu người thực hiện; mọi thay đổi cấu hình được **trigger DB** ghi audit (trước → sau); lô 消費期限 bị allocation loại được ghi event BR-EXP-02 đúng một lần (ràng buộc `allocation_exceptions_once`).
- Kiểm thử: 13 unit test luật (`npm test`), 26 test hồi quy SQL (`npm run db:test`), 7 kịch bản E2E trên trình duyệt (`npm run test:e2e`).

## 3. Rủi ro cần nói rõ với khách khi demo

- Đây là prototype: chưa kiểm thử bảo mật/hiệu năng, chưa sao lưu, chưa SSO.
- Supabase Free tự tạm dừng khi không có truy cập; mở link thấy lỗi kết nối thì Resume project (xem README).
