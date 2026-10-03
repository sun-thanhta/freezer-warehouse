# Definition of Done — YCCMS

> The criteria that decide whether this project can be closed, and the record of the closing judgement.
> §1 is filled in during initial setup; §4 only at closing.

> **Căn cứ (đầu vào thay thế, vì `function-list.md` / `non-function-list.md` / `overview.md` / `stakeholders.md` chưa được lập):**
> - Phạm vi chức năng: bộ thiết kế **LAB-4** — `01-basic-design/01-system-overview-and-scope.md` §1.3 (8 module thiết kế chi tiết, 6 module mức kiến trúc), 14 màn lõi, đặc tả `03-detail-design/`, ADR-001…005, `05-database/02` (khe hở D-01…D-23). Bản sống: `yccms/docs/`.
> - Chỉ tiêu phi chức năng, cổng nghiệm thu, quản trị: ma trận tuân thủ RFP `LAB-1/Yuki_Workbook_v2-RFP.xlsx` sheet `06_Compliance (88)` (NFR-*, ACC-*, OPS-*, DR-*, IF-*).
> - Kế hoạch: `schedule.md` (Epic E-01…E-13, mốc M-01…M-11).
>
> **Trạng thái:** 27 tiêu chí ở §1 được PM chấp nhận nguyên bản dự thảo ngày 2026-10-03. Còn mở, cần xác nhận với khách: loại hợp đồng và mốc thanh toán (D-025, D-026; Q-06); môi trường ngoài máy dev cho load test / UAT / production (D-010, D-012, D-020, D-022 — mâu thuẫn với ADR-006 "chỉ chạy local"); đặc tả IF-ERP-01 / IF-MAP-01 / IF-IDP-01 / CSV logger (D-006…D-008).

## 1. Completion Criteria

| D-ID | Category | Criterion | Judgement method / evidence | Status | Handling | Reason | Approver | Approval date | Related ID | Update date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | Functional requirements | 8 module LAB-4 thiết kế chi tiết (14 màn lõi) hoàn thành theo đặc tả `yccms/docs/03-detail-design/` và được Yuki chấp nhận qua UAT | Báo cáo UAT theo từng SCR; mọi story E-01…E-08 có ngày sprint trong `schedule.md` đạt DoD story | not judged | | | | | SCR-00, 01, 02, 03, 05, 07, 08, 10, 12, 13, 15, 27, 32, 34 · E-01…E-08 | 2026-10-03 |
| D-002 | Functional requirements | Chuỗi loại trừ allocation FR-OUT-02 đúng thứ tự ①消費期限 → ②dải nhiệt → ③隔離 → ④delivery window → ⑤日付逆転 → FEFO (cùng hạn → FIFO), khớp nhau ở lớp TS và SQL; 賞味 = cảnh báo, 消費 = hard stop | Cổng **ACC-DATE-01** đạt; unit test + pgTAP + E2E chạy đủ fixture R-06; không vi phạm 4 "lỗi nghiêm trọng" S5-03 | not judged | | | | | FR-OUT-02, BR-EXP-01/02, BR-FEFO-01, BR-DELWIN-01 · E-05-S02 | 2026-10-03 |
| D-003 | Functional requirements | 日付逆転 bị chặn đúng theo cặp khách × SKU (không so hôm nay, không mượn lịch sử khách khác); ngoại lệ chỉ qua maker-checker (người lập ≠ người duyệt); nhật ký ngoại lệ bất biến | ACC-DATE-01; test: CUS-003/CHI-002 bị chặn, CUS-004/CUS-005 không bị ảnh hưởng, tự duyệt bị từ chối, giao đồng thời không lọt (test 2 phiên) | not judged | | | | | BR-DATE-01, DR-HIST-01, NFR-SEC-02 · E-06 | 2026-10-03 |
| D-004 | Functional requirements | Luồng kho đầu-cuối nhập → lô → allocation → pick → dispatch → POD chạy không bỏ bước, gồm POD 車上渡し / 軒先渡し | Cổng **ACC-FUN-01** đạt | not judged | | | | | ACC-FUN-01, FR-OUT-03…06, BR-POD-01 · E-03, E-05, E-09 | 2026-10-03 |
| D-005 | Functional requirements | Truy xuất 3 lane (gạo 産地・取引, bò mã 10 số / 9 số → business-review, nội bộ) và recall có đối soát số lượng | Cổng **ACC-TRC-01** đạt | not judged | | | | | FR-TRC-01/02/03, BR-TRACE-01/02/03, DR-TRACE-01 · E-03-S03, E-07 | 2026-10-03 |
| D-006 | Functional requirements | Giám sát nhiệt logger & HACCP: import CSV, đánh giá theo ngưỡng phiên bản, alarm, deviation, completeness | Cổng **ACC-TEMP-01** đạt; đặc tả F07 đã được duyệt (LAB-4 mới ở mức kiến trúc) | not judged | | | | | FR-TEMP-01…04, BR-HACCP-01, DR-TEMP-01 · E-11 | 2026-10-03 |
| D-007 | Functional requirements | Lập tuyến & kiểm giờ lái 2024: vi phạm → cấm publish; tuyến có version; sự cố ghi tách | Cổng **ACC-SCH-01** đạt; đặc tả F06 đã được duyệt | not judged | | | | | FR-SCH-01…05, DR-ROUTE-01 · E-10 | 2026-10-03 |
| D-008 | Functional requirements | Tích hợp ERP (SFTP CSV), mapping service, IdP/OIDC, mail relay, archive manifest hoạt động với hệ thống thật của Yuki | Test tích hợp với môi trường đối tác; đặc tả IF-ERP-01 / IF-MAP-01 / IF-IDP-01 (3 Assumption) đã được Yuki cung cấp | not judged | | | | | IF-ERP-01, IF-MAP-01, IF-IDP-01, IF-MAIL-01, IF-ARCH-01, IF-LOG-01 · E-12, E-01-S04 | 2026-10-03 |
| D-009 | Functional requirements | 12 báo cáo vận hành, dashboard KPI và audit export có manifest checksum | Báo cáo UAT; manifest tái tạo được | not judged | | | | | FR-RPT-01/02 · E-08 | 2026-10-03 |
| D-010 | Non-functional requirements (quality & performance) | Hiệu năng: p95 đọc ≤ 2s / ghi ≤ 3s ở đúng 80 người dùng đồng thời; truy xuất 3 năm ≤ 60s trên 300.000 dòng giao + 2,5 triệu số đo nhiệt | Báo cáo load test (80 user, dataset NFR-PERF-02) trên môi trường cấu hình như production | not judged | | | | | NFR-PERF-01, NFR-PERF-02 | 2026-10-03 |
| D-011 | Non-functional requirements (quality & performance) | Bảo mật: SSO + MFA cho vai trò cao, RBAC tối thiểu quyền, maker-checker, mã hóa transit/DB/đính kèm, secret ngoài mã nguồn, audit append-only; các khe hở prototype D-21, D-22 (LAB-4 `05-database/02`) không tồn tại trong bản build | Báo cáo security review / pentest không còn lỗi critical / high mở; pgTAP RLS xanh | not judged | | | | | NFR-SEC-01/02/03, NFR-AUD-01 | 2026-10-03 |
| D-012 | Non-functional requirements (quality & performance) | Liên tục: diễn tập khôi phục đạt RTO 4h / RPO 15′; khả dụng 99,5%/tháng trong 05:00–23:00 JST; queue POD offline mã hóa ≤ 8h | Biên bản restore drill; số đo khả dụng trong 4 tuần hypercare (99,5%/tháng chỉ đo đủ sau go-live) | not judged | | | | | NFR-BCP-01, NFR-AVL-01, NFR-AVL-02 | 2026-10-03 |
| D-013 | Non-functional requirements (quality & performance) | Observability: metrics / log / trace / alert có correlation ID, runbook cho từng cảnh báo | Kiểm tra trên môi trường production + runbook đã duyệt | not judged | | | | | NFR-OPS-01 | 2026-10-03 |
| D-014 | Non-functional requirements (quality & performance) | Giao diện, thông báo lỗi, báo cáo tiếng Nhật + JST; WCAG 2.2 AA | Kiểm thử bản địa hóa; báo cáo kiểm thử accessibility | not judged | | | | | NFR-LOC-01, NFR-ACC-01 · E-13 | 2026-10-03 |
| D-015 | Documents & deliverables | Bộ thiết kế `yccms/docs/` (kiến trúc, ER, đặc tả màn / API, ADR) khớp với code tại thời điểm go-live; `05-database/03-implementation-status.md` phủ đủ 29 bảng thiết kế | Review tài liệu so với code (doc parity) được Yuki duyệt | not judged | | | | | LAB-4 · `yccms/docs/` | 2026-10-03 |
| D-016 | Documents & deliverables | Bàn giao mã nguồn, migration, test và hướng dẫn dựng môi trường; dựng lại được từ đầu trên máy sạch theo README | Biên bản bàn giao + chạy thử dựng môi trường theo tài liệu | not judged | | | | | `yccms/` | 2026-10-03 |
| D-017 | Documents & deliverables | Hướng dẫn sử dụng theo vai trò (tiếng Nhật) và tài liệu vận hành (runbook, quy trình sự cố) | Tài liệu được Yuki duyệt | not judged | | | | | OPS-TRN-01, NFR-OPS-01 | 2026-10-03 |
| D-018 | Documents & deliverables | Biên bản rà soát lại nguồn luật (物流2024, 米/牛トレーサビリティ法, HACCP) trước design freeze và trước go-live | Biên bản re-verify có người ký | not judged | | | | | OPS-LAW-01 | 2026-10-03 |
| D-027 | Documents & deliverables | Hồ sơ quản trị dự án đầy đủ và truy vết được: biên bản họp, RAID, decision log, change log (yêu cầu / dữ liệu / người duyệt / ngày hiệu lực, có phân tích tác động); không hạng mục nào vào sprint khi chưa có owner + tiêu chí chấp nhận | Rà soát `mtg-logs/`, `risks-problems/`, `decision.md`, `07_feedbacks/change-request.md` lúc đóng dự án | not judged | | | | | OPS-GOV-01, OPS-CHG-01 | 2026-10-03 |
| D-019 | Testing & acceptance | IT và ST hoàn tất; mỗi test truy vết được tới yêu cầu / dữ liệu / môi trường / kết quả / lỗi; 88 yêu cầu trong ma trận tuân thủ đều có kết quả test; không còn lỗi critical / high mở | Báo cáo IT, ST + ma trận truy vết test | not judged | | | | | OPS-TEST-01 · 88 yêu cầu RFP | 2026-10-03 |
| D-020 | Testing & acceptance | UAT do Yuki thực hiện hoàn tất: đủ 8 cổng nghiệm thu ACC-* đạt, 0 lỗi critical, có chữ ký chấp nhận của Yuki | Báo cáo UAT + biên bản chấp nhận | not judged | | | | | ACC-FUN-01, ACC-TEMP-01, ACC-DATE-01, ACC-SCH-01, ACC-TRC-01, ACC-MIG-01, ACC-NFR-01, ACC-GO-01 · M-08 | 2026-10-03 |
| D-021 | Testing & acceptance | Migration: 2 lần rehearsal, lineage file / dòng / biến đổi / kết quả, dòng bị từ chối có lý do, business sign-off đối soát | Cổng **ACC-MIG-01** đạt; biên bản đối soát rehearsal #1, #2 và final load | not judged | | | | | DR-MIG-01, ACC-MIG-01 · M-05, M-07 | 2026-10-03 |
| D-022 | Operational transition & handover | Go-live: 6 owner ký go/no-go, rủi ro tồn được ghi nhận, rollback sẵn sàng; tách dev/test/UAT/prod, release có checksum / diff / phê duyệt / backup | Cổng **ACC-GO-01** đạt; biên bản go/no-go | not judged | | | | | ACC-GO-01, OPS-ENV-01 · M-09, M-10 | 2026-10-03 |
| D-023 | Operational transition & handover | Đào tạo theo từng vai trò bằng tiếng Nhật (không gộp chung), sandbox dữ liệu đã mask | Danh sách buổi đào tạo + người tham dự theo vai trò | not judged | | | | | OPS-TRN-01 | 2026-10-03 |
| D-024 | Operational transition & handover | Hypercare 4 tuần sau go-live với severity matrix, escalation, báo cáo SLA; bàn giao sang vận hành / hợp đồng hỗ trợ định kỳ | Báo cáo SLA hypercare + biên bản bàn giao vận hành | not judged | | | | | OPS-SUP-01 · M-11 | 2026-10-03 |
| D-025 | Contract & billing | Hoàn thành phạm vi hợp đồng và nhận biên bản nghiệm thu (検収書) từ Yuki — áp dụng nếu hợp đồng là trọn gói (proposal LAB-1 báo giá one-time ¥35,7M) | Biên bản nghiệm thu có chữ ký | not judged | | | | | — | 2026-10-03 |
| D-026 | Contract & billing | Xuất hóa đơn và thu đủ theo các mốc thanh toán của hợp đồng | Hóa đơn + xác nhận thanh toán; mốc thanh toán chờ chốt (câu hỏi Q-06: tiền tệ / thuế / milestone) | not judged | | | | | — | 2026-10-03 |

## 2. Category Guidelines

| Category | What it covers | In scope? |
| --- | --- | --- |
| Functional requirements | Whether the functions in `function-list.md` are complete and accepted | Có — tạm dựa trên phạm vi LAB-4 + feature list RFP vì `function-list.md` chưa có. Module LAB-4 mới ở mức kiến trúc (D-004…D-009) chỉ đánh giá được khi đặc tả được duyệt |
| Non-functional requirements (quality & performance) | Whether the `non-function-list.md` targets are met | Có — chỉ tiêu lấy từ 12 NFR của RFP. NFR-AVL-01 (99,5%/tháng) chỉ đo được sau go-live → đánh giá trên số đo hypercare |
| Documents & deliverables | Whether the contracted deliverables have been handed over | Có — danh mục bàn giao chính thức chờ hợp đồng / `overview.md` |
| Testing & acceptance | Test completion and the client's acceptance | Có — UAT do Yuki thực hiện (Sun* hỗ trợ), theo 8 cổng ACC-* |
| Operational transition & handover | Handover to operations, manuals, training | Có — đến hết hypercare 4 tuần. Bảo trì dài hạn ngoài phạm vi (báo giá định kỳ riêng ở sheet `08_Cost` mục ②) |
| Contract & billing | Acceptance certificate, invoicing, contract closing | Có — tạm giả định hợp đồng trọn gói; chờ `overview.md` §1 xác nhận loại hợp đồng |

## 3. Status Definitions & the Flow for Unmet Criteria

> **Fixed definitions — never rewrite this section.** This skill applies them; changing them is out of scope.

**Statuses**: `not judged` / `met` / `partially met` / `not met`.

**Flow for unmet and partially met criteria**:

1. Propose the handling — **address and meet it** / **waive it (out of scope)** / **defer it to the next phase** — with the reason, as a draft needing confirmation.
2. Take it through the approver for that subject in `stakeholders.md` §3 and record the review and approval status.
3. Finalize status / handling / reason / approver / approval date / update date **only for approved rows**. Unapproved rows stay on hold as "awaiting approval".
4. When an important decision arises, prompt the user to record it in `decision.md` (never edit that file from here).

## 4. Overall Closing Judgement

| Item | Content |
| --- | --- |
| Overall achievement rate | <!-- met ÷ total; filled in at closing --> |
| Waived items | <!-- count --> |
| Deferred items | <!-- count --> |
| Final approver | |
| Approval date | |
| Overall comment | |

## 5. Revision History

| Date | Updated by | Content |
| --- | --- | --- |
| 2026-10-03 | pm-define-dod skill | Tạo mới (thiết lập ban đầu): 27 tiêu chí dự thảo (chức năng 9, phi chức năng 5, tài liệu 5, kiểm thử & nghiệm thu 3, chuyển giao vận hành 3, hợp đồng 2); ghi chú phạm vi cho 6 nhóm ở §2. Căn cứ: LAB-4 + ma trận tuân thủ RFP (LAB-1) |
| 2026-10-03 | pm-define-dod skill | PM chấp nhận nguyên 27 tiêu chí dự thảo (bỏ nhãn [Dự thảo]); ghi các điểm còn mở cần xác nhận với khách |
