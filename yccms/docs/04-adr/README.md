# ADR — Bản ghi quyết định kiến trúc

Mỗi ADR ghi một quyết định có đánh đổi thật. Một bản ghi gồm: **bối cảnh**, **lựa chọn đã chọn**, **các phương án đã bỏ và vì sao**, **hệ quả** (cả tốt lẫn xấu phải chịu), và cách kiểm chứng hoặc điều kiện xem xét lại.

| # | Quyết định | Trạng thái | Ngày |
|---|---|---|---|
| [ADR-001](adr-001-business-writes-in-sql-functions-with-deny-by-default-rls.md) | Mọi thao tác ghi nghiệp vụ đi qua hàm SQL `SECURITY DEFINER`; RLS chặn ghi trực tiếp | Đã chấp nhận (đã cài ở prototype) | 2026-10-03 |
| [ADR-002](adr-002-nextjs-route-handlers-as-bff-no-direct-db-from-browser.md) | Route Handler của Next.js làm BFF; trình duyệt không truy vấn bảng Supabase trực tiếp | Đã chấp nhận (đã cài) | 2026-10-03 |
| [ADR-003](adr-003-date-reversal-check-per-customer-sku-two-layer-with-locks.md) | 日付逆転: mốc là hạn lớn nhất theo cặp khách × SKU; kiểm 2 lớp; khóa theo cặp; ngoại lệ maker-checker giữ cố định bộ phân bổ | Đã chấp nhận (đã cài); điểm diễn giải RFP chờ khách xác nhận (Q2) | 2026-10-03 |
| [ADR-004](adr-004-effective-dated-master-with-change-requests.md) | Master và cấu hình nghiệp vụ có phiên bản theo ngày hiệu lực, thay đổi qua change request | Đề xuất cho bản build (prototype chưa làm) | 2026-10-03 |
| [ADR-005](adr-005-supabase-and-vercel-managed-platform.md) | Nền tảng managed: Supabase (Postgres + Auth) + Vercel, vùng Tokyo | Đã chấp nhận (stack do khách chốt); có điều kiện nâng gói | 2026-10-03 |
| [ADR-006](adr-006-local-first-development-with-supabase-cli.md) | Giai đoạn đầu chỉ chạy local: Supabase CLI trên Docker (Colima), hoãn Supabase cloud + Vercel | Đã chấp nhận | 2026-10-03 |

Quy ước: ADR không sửa nội dung sau khi chấp nhận. Muốn đổi quyết định thì viết ADR mới với trạng thái "Thay thế ADR-xxx".
