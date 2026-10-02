# LAB-1 — Gói đề xuất YCCMS (kho lạnh Yuki)

> **BẢN v2 (chuẩn RFP) là bản dùng chính.** Bản v1 được tạo khi chưa có RFP (thư mục trống) nên dựa trên giả định; đã bị thay thế sau khi đối chiếu RFP thật `product-b-rfp-ja-v2.0-rc4.pdf` (YCL-RFP-2026-01 v2.0).

Khách (mô phỏng): **ユキコールドロジスティクス株式会社** · Vendor: **Sun VN02** · PL: **Thanh Ta**

## Bộ deliverable v2 (dùng để nộp)

| File | Nội dung |
|---|---|
| `Yuki_Workbook_v2-RFP.xlsx` | 10 sheet: câu hỏi, function (12), feature (47, gắn mã FR/BR), màn hình (41), user story (12, theo fixture R-06), **ma trận tuân thủ 88 yêu cầu**, estimate/WBS (công thức), **cost theo template S5-02**, rủi ro, dữ liệu RFP (12 SKU) |
| `Yuki_Proposal_v2-RFP.pptx` | Slide 13 trang theo **cấu trúc S5-01** (tổng quan → tuân thủ 88 → kiến trúc → kế hoạch/timeline 2027-06-01 → test/migration → câu hỏi/rủi ro); dấu Sun* đỏ góc phải |
| `Yuki_00_Trich-yeu-cau-RFP_v2.docx` | Bản trích xuất yêu cầu từ RFP thật (thay bộ tài liệu khách giả định) |
| `Yuki_09_Quick-Report_v2.docx` | Ghi chú làm việc với AI (gồm diễn biến rà soát & sửa) |
| `product-b-rfp-ja-v2.0-rc4.pdf` | RFP gốc (khách cung cấp) |

## Con số chính (base scope, chuẩn RFP)
- Phạm vi: 12 SKU · 1 DC · 80 concurrent users · ~88 yêu cầu (86 Comply / 3 Assumption).
- Effort: **~766 MD** (~38 người-tháng). Chi phí one-time giả định: **≈ ¥35.7M** (≈ 6.07 tỷ ₫). Định kỳ & option tách riêng (S5-02).
- Timeline: start 2026-10-05 · BD 8 tuần · build+test 18 tuần · 2 rehearsal · UAT 6 tuần · **go-live 2027-06-01**.

## Điểm sửa chính so với v1
12 SKU (không phải ~1.200) · 冷蔵 0–5°C · 80 user · **FEFO** (không phải FIFO) · 日付逆転 theo cặp khách-SKU · SSO/OIDC bắt buộc · ERP SFTP là scope nền · timeline 2027-06-01 · bổ sung ma trận 88 yêu cầu, workstream NFR, cost template S5-02, chuỗi loại trừ allocation, kiến trúc event bất biến + maker-checker.

## Lưu ý
- Đơn giá ¥/MD, tỉ giá, số giả định (ô nền vàng trong Excel) — cần sales/khách xác nhận.
- 3 điểm Assumption cần làm rõ: đặc tả ERP, license mapping service, IdP/OIDC.
- Số giờ trong Quick Report là ước lượng — điều chỉnh theo thực tế.

## Bản cũ (tham khảo, đã thay thế)
`Yuki_Estimation-Workbook.xlsx`, `Yuki_Proposal.pptx`, `Yuki_00_Bo-tai-lieu-khach_INPUT.docx`, `Yuki_09_Quick-Report.docx` — giữ lại để đối chiếu.
