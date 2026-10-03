# Lộ trình phát triển YCCMS

> Mốc theo RFP: bắt đầu 2026-10-05 · thiết kế cơ bản 8 tuần · build + test 18 tuần · 2 lần migration rehearsal · UAT 6 tuần · go-live **2027-06-01**.
> Thứ tự giai đoạn bám chuỗi nghiệp vụ nhập → tồn → xuất (nơi dồn nhiều luật cứng nhất), mỗi giai đoạn kết thúc bằng màn hình chạy được + test 3 lớp.

| GĐ | Nội dung | Bảng (thiết kế `05-database/01`) | Màn hình | Trạng thái |
|---|---|---|---|---|
| P0 | **Nền tảng local**: Next.js 16 + Supabase CLI/Docker, cổng đăng nhập, `withAuth`, danh tính & vai trò, tài khoản dev, test 3 lớp | `app_users`, `roles`, `user_roles` | SCR-00 (đăng nhập), trang chủ tạm | ✅ Xong (2026-10-03) |
| P1 | **Master & cấu hình**: dải nhiệt có phiên bản, vị trí (-Q), NCC, khách + điểm giao, SKU có phiên bản, hợp đồng khách-SKU có phiên bản, change request (maker-checker), audit log bất biến; seed fixture RFP (12 SKU, CUS-001…005, AGR-001…015) | `temperature_zones(+_versions)`, `locations`, `suppliers`, `customers`, `customer_sites`, `products(+_versions)`, `customer_sku_agreements`, `change_requests`, `audit_logs` | SCR-02, SCR-03, SCR-32, SCR-34, hàng chờ duyệt master (SCR-05 phần master) | ⏳ Kế tiếp |
| P2 | **Nhập kho & tồn kho**: kiểm nhập (nhiệt / lô / hạn / mã gạo-bò / vị trí), 保留 → 隔離, release/scrap, sổ di chuyển tồn | `inbound_receipts`, `inbound_lines`, `inbound_attachments`, `lots`, `lot_regulated_ids`, `inventory_movements` | SCR-07, SCR-08, SCR-10 | Chưa bắt đầu |
| P3 | **Xuất kho**: chuỗi loại trừ FR-OUT-02, FEFO/FIFO, kiểm trước xuất, 日付逆転 + maker-checker, nhật ký ngoại lệ | `outbound_orders`, `outbound_lines`, `outbound_allocations`, `shipment_temperature_checks`, `delivery_history`, `override_requests`, `override_request_items`, `allocation_exceptions` | SCR-12, SCR-13, SCR-15, SCR-05 | Chưa bắt đầu |
| P4 | **Truy xuất, dashboard** | (đọc) | SCR-27, SCR-01, lịch sử giao theo khách | Chưa bắt đầu |
| P5 | **Lên cloud**: Supabase Pro (Tokyo, PITR) + Vercel `hnd1`, 3 môi trường, CI chạy migration + test | — | — | Hoãn (ADR-006) |
| Sau | Theo phạm vi hợp đồng: ERP (IF-ERP-01), SSO/MFA (IF-IDP-01), lập tuyến + giờ lái (F06), logger + HACCP (F07), recall, POD, báo cáo, migration dữ liệu | `erp_import_batches`… | SCR-14, 16–26, 28–31, 33, 35–40 | Chờ đặc tả / Assumption |

## Điều kiện "xong" của mỗi giai đoạn

1. Migration + RLS + hàm SQL theo thiết kế; test pgTAP cho RLS và mọi hàm `SECURITY DEFINER`.
2. API theo `03-detail-design/api-specification.md`; màn hình theo đặc tả và wireframe.
3. Unit test cho luật thuần; ít nhất một E2E cho luồng chính của mỗi màn.
4. `typecheck`, `lint`, `test`, `db:test`, `test:e2e`, `build` đều xanh.
5. Cập nhật `05-database/03-implementation-status.md`, roadmap này và `project-changelog.md`.

## Việc cần khách trả lời trước khi tới giai đoạn liên quan

| Câu hỏi | Chặn giai đoạn |
|---|---|
| Q1: 日付逆転 theo khách hay theo cửa hàng | P3 (P1 đã có `customer_sites` để không phải đổi cấu trúc) |
| Q2: mốc 日付逆転 = lần giao gần nhất hay hạn lớn nhất | P3 |
| Q3: mã bò 9 số → chặn hay 保留 | P2 |
| Q4: duyệt ngoại lệ 1 hay 2 cấp | P3 |
| Q5: ai chốt window AGR-008 / AGR-014 | P1 (dữ liệu seed) |
