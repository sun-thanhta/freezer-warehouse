# Tài liệu dự án YCCMS

> **Yuki Cold-Chain Management System**: kho lạnh 3 dải nhiệt của ユキコールドロジスティクス株式会社.
> Đây là **bộ tài liệu sống** của dự án thật `yccms/`. Bản gốc lấy từ bộ thiết kế LAB-4 v1.0 (2026-10-03, thư mục `LAB-4/` ở gốc repo, giữ nguyên làm mốc nộp). Từ đây mọi thay đổi thiết kế đều sửa trong `yccms/docs/`.

## Mục lục

| Thư mục / file | Nội dung | Ai đọc |
|---|---|---|
| [00-development/local-development-setup.md](00-development/local-development-setup.md) | Cài máy, chạy Supabase local + app, tài khoản dev, lệnh thường dùng, xử lý sự cố | Dev mới vào dự án — **đọc đầu tiên** |
| [00-development/code-standards.md](00-development/code-standards.md) | Cấu trúc thư mục, quy ước code / migration / test / commit | Dev |
| [development-roadmap.md](development-roadmap.md) | Các giai đoạn build, trạng thái từng giai đoạn | PM, dev |
| [project-changelog.md](project-changelog.md) | Nhật ký thay đổi đáng kể | Mọi người |
| [01-basic-design/](01-basic-design/) | Tổng quan & phạm vi, **kiến trúc + luồng dữ liệu**, danh sách màn hình + phân quyền | PM, dev, QA |
| [02-wireframes/](02-wireframes/) | Wireframe 14 màn lõi (phần tử đánh số `[n]`) | Dev frontend, QA |
| [03-detail-design/](03-detail-design/) | Quy tắc chung, đặc tả từng màn, **đặc tả API**, luật nghiệp vụ + máy trạng thái + mã lỗi | Dev, QA |
| [04-adr/](04-adr/) | Quyết định kiến trúc (ADR-001…006) | Dev, reviewer |
| [05-database/](05-database/) | **ER thiết kế đích** + định nghĩa bảng, trạng thái cài đặt, bảng tham khảo bẫy từ prototype | Dev backend |

## Quy ước đọc

| Ký hiệu | Ý nghĩa |
|---|---|
| `SCR-xx` | Mã màn hình theo workbook RFP (LAB-1 v2) |
| `FR-` / `BR-` / `NFR-` / `DR-` / `IF-` | Mã yêu cầu RFP |
| **[Prototype khác]** | Chỗ prototype làm khác thiết kế. Dự án thật làm theo **thiết kế**, không theo prototype |
| **[Chờ khách]** | Câu hỏi nghiệp vụ còn mở (Q1…Q5 ở `01-basic-design/01-system-overview-and-scope.md` §1.7) |
| Đường dẫn `yccms-prototype/…` | Cài đặt tham chiếu ở prototype, đọc để học cách làm; code thật nằm ở `yccms/` |

## Cập nhật tài liệu

- Xong một giai đoạn → cập nhật `development-roadmap.md` và thêm dòng `project-changelog.md`.
- Thêm/sửa migration → cập nhật `05-database/03-implementation-status.md`. Nếu lệch thiết kế thì sửa `05-database/01-…` trước, có lý do.
- Quyết định kiến trúc mới → ADR mới (không sửa ADR đã chấp nhận).
- Đổi hành vi màn hình / API → sửa đặc tả trong `03-detail-design/` cùng PR với code.
