# LAB-4 — Bộ thiết kế hệ thống YCCMS (cơ bản + chi tiết)

> Dự án: **Yuki Cold-Chain Management System (YCCMS)**, kho lạnh 3 dải nhiệt của ユキコールドロジスティクス株式会社 (khách mô phỏng)
> Vendor: Sun VN02 · PL: Thanh Ta · Phiên bản 1.0 · 2026-10-03
> Đầu vào: RFP `YCL-RFP-2026-01 v2.0` (LAB-1 bản v2), prototype đang chạy tại <https://yccms-prototype.vercel.app> (mã nguồn `yccms-prototype/`), schema thật trên Supabase project `upngghuyjvwhlxaqqqml`.

## 1. Bộ tài liệu gồm những gì

| # | Loại tài liệu | File | Nội dung chính |
|---|---|---|---|
| 1 | Thiết kế cơ bản — tổng quan | [01-basic-design/01-system-overview-and-scope.md](01-basic-design/01-system-overview-and-scope.md) | Mục tiêu, phạm vi thiết kế, tác nhân/vai trò, danh sách module, giả định |
| 2 | **Thiết kế kiến trúc** | [01-basic-design/02-architecture-and-data-flow.md](01-basic-design/02-architecture-and-data-flow.md) | Sơ đồ ngữ cảnh, kiến trúc logic, triển khai, các lớp bảo mật, **luồng dữ liệu** của từng nghiệp vụ, xử lý lỗi, đáp ứng NFR |
| 3 | Danh sách màn hình, chuyển màn, phân quyền | [01-basic-design/03-screen-list-navigation-and-permissions.md](01-basic-design/03-screen-list-navigation-and-permissions.md) | 14 màn lõi, sơ đồ chuyển màn, ma trận vai trò × thao tác |
| 4 | **Wireframe** | [02-wireframes/](02-wireframes/) (4 file) | Wireframe chi tiết mọi màn lõi, đánh số từng phần tử để tra sang đặc tả |
| 5 | **Đặc tả màn hình / thiết kế chi tiết** | [03-detail-design/](03-detail-design/) | Quy tắc chung + 10 file đặc tả màn hình (field · validation · trạng thái · phân quyền · thông báo lỗi), đặc tả API, luật nghiệp vụ & máy trạng thái |
| 6 | **ADR** | [04-adr/](04-adr/) (5 bản ghi) | Bối cảnh · lựa chọn đã chọn · phương án đã bỏ và vì sao · hệ quả (kể cả hệ quả xấu) |
| 7 | **Sơ đồ cơ sở dữ liệu** | [05-database/](05-database/) | ER thiết kế (thực thể · quan hệ · PK/FK), định nghĩa bảng, **đối chiếu với bảng thật của prototype** và chỗ prototype làm khác |

## 2. Đọc theo thứ tự nào

- **Khách / PM:** README → `01-system-overview-and-scope` → `03-screen-list…` → wireframe → ADR.
- **Dev / reviewer kỹ thuật:** `02-architecture-and-data-flow` → `05-database` → `03-detail-design/api-specification` → đặc tả từng màn → ADR.
- **QA:** đặc tả màn hình (mục validation, trạng thái, thông báo lỗi) → `business-rules-and-state-machines`.

## 3. Phạm vi của bản thiết kế

- **Chi tiết đến mức build được:** 14 màn lõi đã có trong prototype, gồm nhập kho & kiểm hàng, tồn kho & 隔離, xuất kho với chuỗi loại trừ FR-OUT-02, **cảnh báo/chặn 日付逆転** + maker-checker, hợp đồng khách-SKU, cấu hình ngưỡng nhiệt/SKU, truy xuất, audit.
- **Chỉ ở mức kiến trúc (khối + giao diện):** lập tuyến & giờ lái (F06), logger nhiệt & HACCP (F07), recall, POD, ERP, SSO. Các phần này có chỗ đứng trong sơ đồ để không phải đập lại kiến trúc về sau, nhưng chưa có wireframe/đặc tả. Lý do xem mục 4 của `01-system-overview-and-scope`.
- Thiết kế mô tả **hệ thống đích** (bản chạy thật). Mọi chỗ prototype hiện làm khác đều đánh dấu **[Prototype khác]**, kèm lý do và hướng xử lý.

## 4. Quy ước trong tài liệu

| Ký hiệu | Ý nghĩa |
|---|---|
| `SCR-xx` | Mã màn hình theo workbook LAB-1 v2 (41 màn) |
| `FR-` / `BR-` / `NFR-` / `DR-` / `IF-` | Mã yêu cầu trong RFP (xem sheet `06_Compliance (88)` của workbook) |
| **[Prototype khác]** | Điểm hệ thống đích khác prototype hiện tại |
| **[Chờ khách]** | Câu hỏi nghiệp vụ còn mở, thiết kế chọn tạm một hướng |
| `[n]` trong wireframe | Số thứ tự phần tử, khớp cột "No." trong bảng đặc tả màn hình |
| Ngày giờ | Hiển thị theo JST (Asia/Tokyo); lưu `timestamptz` (ISO 8601) |

Sơ đồ viết bằng Mermaid (xem được trên GitHub/VS Code); wireframe là khung ASCII để diff và review trong PR.

## 5. Giả định khi viết

1. Quy mô theo RFP: 1 trung tâm (DC), 80 người dùng đồng thời, ~1.800 dòng nhập/tháng, ~7.200 dòng xuất/tháng.
2. Stack giữ như prototype: Next.js trên Vercel + Supabase (Postgres, Auth) vùng Tokyo. Đây là quyết định kiến trúc có ghi lại (ADR-001, ADR-002).
3. Ba điểm Assumption của RFP chưa có đặc tả, gồm ERP (IF-ERP-01), mapping service (IF-MAP-01) và IdP/OIDC (IF-IDP-01). Bản thiết kế chỉ vẽ ranh giới giao diện cho ba điểm này, chưa chốt định dạng.
4. Các câu hỏi khách chưa trả lời (danh sách ở `03-demo/demo-script-for-client.md` của prototype) được đánh dấu **[Chờ khách]** ở đúng chỗ bị ảnh hưởng.
