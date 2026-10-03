# Schedule — YCCMS

> The plan baseline. Actual progress against it is recorded in `progress.md` (owned by `pm-report-project`).
> Assumptions and constraints belong in `overview.md` — never write them here.
> **The WBS goes down to the Story level only.** Tasks live in `task-list.md` (owned by `pm-create-tasks`).

> **Nguồn số liệu** (tham chiếu, không phải giả định):
> - **Phạm vi & cấu trúc Epic/Story:** bộ thiết kế LAB-4 — `LAB-4/01-basic-design/01-system-overview-and-scope.md` §1.3 (module), `03-screen-list-navigation-and-permissions.md` (14 màn lõi), `LAB-4/03-detail-design/` (đặc tả), `LAB-4/04-adr/adr-004-…` (phiên bản cấu hình + change request), `LAB-4/05-database/01-…` (bảng). Bản sống: `yccms/docs/`.
> - **Mốc thời gian:** khung RFP `YCL-RFP-2026-01 v2.0` (start 2026-10-05 · basic design 8 tuần · build + test 18 tuần · UAT 6 tuần · go-live 2027-06-01), ghi lại ở `LAB-1/Yuki_Workbook_v2-RFP.xlsx` sheet `10_Du lieu RFP`.
> - **Ràng buộc giờ lái 2024 (E-10):** RFP FR-SCH-01…05, US-06, DR-ROUTE-01, ACC-SCH-01 và số giờ Yuki công bố (workbook LAB-1 sheet `00_Huong dan`, `05_User stories`). Thiết kế chi tiết LAB-4 **chưa có** module này (F06 chỉ ở mức kiến trúc, `01-system-overview-and-scope.md` §1.3).
> - **Effort:** `LAB-1/Yuki_Workbook_v2-RFP.xlsx` sheet `07_Estimate-WBS` (tổng 765,96 MD base scope); effort màn hình theo độ phức tạp ở sheet `04_Man hinh`.
>
> **Trạng thái: BASELINE v1.0 — PM duyệt ngày 2026-10-03.** Còn mở: capacity từng thành viên (chưa có `stakeholders.md`), loại hợp đồng (`overview.md`), function list chuẩn (`function-list.md`, hiện dùng mã SCR / FE làm khóa tạm), ngày của các story tạm (TBD, chờ đặc tả). Khi các mục này được chốt, chạy lại SCH để cập nhật baseline.

## 1. Master Schedule (by phase)

> One row per work item. `overview.md` §4 chưa có → các pha lấy từ khung RFP + mục C của estimate (P-RD, P-BD, Build, P-NFR, P-IT, P-ST, P-MIG, P-UAT, P-INFRA, P-TRN). Client-side phases stay listed, so dependencies stay visible.

| Phase | Performed by | Start date (planned) | End date (planned) | Main deliverables | Related milestone ID |
| --- | --- | --- | --- | --- | --- |
| Khởi động & phân tích yêu cầu (P-RD, 26 MD) | Joint (Sun* BA/BrSE; Yuki trả lời Q1–Q5, Q-01…Q-06) | 2026-10-05 | 2026-10-30 | Function list chốt, compliance matrix 88 yêu cầu, `qa.md` đã trả lời | M-01, M-02 |
| Thiết kế cơ bản (P-BD, 30 MD) | Sun* (Yuki review & sign-off) | 2026-10-05 | 2026-11-27 | `yccms/docs/` (kiến trúc, ER, đặc tả màn/API, ADR) bản sign-off; khởi điểm là LAB-4 v1.0 | M-03 |
| Hạ tầng / CI-CD & môi trường (P-INFRA, 16 MD) | Sun* | 2026-11-30 | 2027-03-26 | Môi trường dev/test/UAT/prod, pipeline CI chạy migration + test | M-06 |
| Thiết kế chi tiết + phát triển + UT (Build: màn hình 243,5 + engine 148 MD) | Sun* | 2026-11-30 | 2027-02-26 | Code + unit test theo §3 (sprint S1–S6, 2 tuần/sprint) | M-04 |
| NFR workstream (P-NFR, 40 MD) | Sun* | 2026-12-14 | 2027-04-02 | SSO/MFA, mã hóa, hiệu năng @80 user + trace ≤ 60s, BCP, observability, WCAG 2.2 AA | M-06 |
| Integration test (P-IT, 18 MD) | Sun* | 2027-03-01 | 2027-03-12 | Báo cáo IT | M-06 |
| System test (P-ST, 24 MD) | Sun* | 2027-03-15 | 2027-04-02 | Báo cáo ST (gồm fixture R-06) | M-06 |
| Data migration (P-MIG, 30 MD) | Joint (Yuki cấp dữ liệu nguồn, ký đối soát) | 2027-01-04 | 2027-05-31 | Lineage, rehearsal #1, #2, final load + đối soát | M-05, M-07, M-09 |
| Acceptance test — UAT (P-UAT hỗ trợ, 16 MD) | Client (Sun* hỗ trợ) | 2027-04-05 | 2027-05-14 | Kết quả 8 cổng nghiệm thu ACC-* | M-08 |
| Đào tạo theo vai trò (P-TRN) | Sun* | 2027-04-19 | 2027-05-14 | Tài liệu + buổi đào tạo tiếng Nhật | M-08 |
| Cutover & production release | Joint | 2027-05-17 | 2027-06-01 | Go/no-go, final load, parallel-run (hệ cũ read-only) | M-09, M-10 |
| Hypercare 4 tuần (P-TRN) | Sun* | 2027-06-01 | 2027-06-28 | Báo cáo SLA / sự cố | M-11 |
| PM / PMO (15% core, 90,8 MD) | Sun* | 2026-10-05 | 2027-06-28 | Báo cáo tuần, quản lý rủi ro / thay đổi | — |

<!-- Build + test = 2026-11-30 → 2027-04-02 = 18 tuần (RFP). UAT = 2027-04-05 → 2027-05-14 = 6 tuần (RFP).
     2027-05-17 → 2027-05-31: cutover + đệm trước go-live 2027-06-01. -->

## 2. Milestones

| M-ID | Milestone | Planned date | Completion condition | Related phase |
| --- | --- | --- | --- | --- |
| M-01 | Kickoff | 2026-10-05 | Họp khởi động, chốt kênh liên lạc & quy trình duyệt (nguồn: RFP) | Khởi động & phân tích yêu cầu |
| M-02 | Sign-off yêu cầu | 2026-10-30 | Function list + compliance matrix được Yuki duyệt; Q1–Q5 (LAB-4 §1.7) đã có câu trả lời | Khởi động & phân tích yêu cầu |
| M-03 | Sign-off thiết kế cơ bản | 2026-11-27 | `yccms/docs/` được Yuki duyệt (8 tuần, nguồn: RFP) | Thiết kế cơ bản |
| M-04 | Hoàn thành phát triển (code freeze) | 2027-02-26 | Mọi story §3 trong sprint S1–S6 đạt DoD | Thiết kế chi tiết + phát triển + UT |
| M-05 | Migration rehearsal #1 | 2027-03-19 | Chạy thử toàn bộ, đối soát số dòng accept/reject/duplicate/business-review | Data migration |
| M-06 | Hoàn thành ST / sẵn sàng UAT | 2027-04-02 | IT + ST đạt; NFR đo đạt; môi trường UAT sẵn sàng (hết 18 tuần build + test, nguồn: RFP) | System test |
| M-07 | Migration rehearsal #2 | 2027-04-30 | Đối soát lần 2 được business sign-off | Data migration |
| M-08 | Hoàn thành UAT | 2027-05-14 | 8 cổng ACC-* đạt (6 tuần, nguồn: RFP) | Acceptance test — UAT |
| M-09 | Go / no-go | 2027-05-21 | Quyết định go-live; kế hoạch rollback được duyệt | Cutover & production release |
| M-10 | Go-live | 2027-06-01 | Hệ thống chạy production (nguồn: RFP — mốc cố định) | Cutover & production release |
| M-11 | Kết thúc hypercare | 2027-06-28 | 4 tuần hypercare, báo cáo SLA | Hypercare |

## 3. WBS (Epic / Story)

> **Epic = function group, Story = function.** Never split an Epic by phase, and never add Task rows.
> Story IDs inherit their parent Epic (`E-01` → `E-01-S01`).
> Epic theo module LAB-4 §1.3. Story theo 14 màn lõi + đặc tả `LAB-4/03-detail-design/` (module **chi tiết**) — xếp vào sprint. Module LAB-4 chỉ có **kiến trúc** → Epic/Story **tạm**, ngày `TBD (chờ đặc tả)`; tên story lấy từ feature list LAB-1 (FE-xx), xem lại khi có đặc tả.
> `Related F-ID`: chưa có `function-list.md` → ghi mã màn `SCR-xx` (LAB-4) và feature `FE-xx` (LAB-1) làm khóa tạm; đổi sang `F-xxx` khi REQ lập function list.
> Sprint (2 tuần): S1 11/30–12/11 · S2 12/14–12/25 · (12/28–01/01 nghỉ cuối năm / đệm) · S3 01/04–01/15 · S4 01/18–01/29 · S5 02/01–02/12 · S6 02/15–02/26.

| WBS ID | Type | Name | Related F-ID | Start date (planned) | End date (planned) | Related milestone ID | Dependencies |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | Epic | Đăng nhập, phân quyền & audit (= F11 phần chức năng) | | 2026-11-30 | 2026-12-11 | M-04 | |
| E-01-S01 | Story | Đăng nhập & cổng truy cập (nền đã dựng ở P0 ngày 2026-10-03; S1 hoàn thiện theo đặc tả) | SCR-00 | 2026-11-30 | 2026-12-11 | M-04 | — |
| E-01-S02 | Story | Vai trò & RBAC nền (`app_users`, `roles`, `user_roles`; nền đã có ở P0) | FE-43 | 2026-11-30 | 2026-12-11 | M-04 | E-01-S01 |
| E-01-S03 | Story | Audit log append-only | SCR-34, FE-43 | 2026-11-30 | 2026-12-11 | M-04 | E-01-S02 |
| E-01-S04 | Story | SSO + MFA với IdP doanh nghiệp (tạm) | FE-43, FE-42 | TBD (chờ IF-IDP-01) | TBD | M-04 | Q-03 (IdP/OIDC), E-01-S01 |
| E-02 | Epic | Master & hợp đồng khách-SKU (= F01) | | 2026-11-30 | 2027-01-29 | M-04 | |
| E-02-S01 | Story | Dữ liệu nền: NCC, khách, điểm giao, vị trí (-Q) + fixture RFP (12 SKU, CUS-001…005, AGR-001…015) | FE-03 | 2026-11-30 | 2026-12-11 | M-04 | E-01-S02 |
| E-02-S02 | Story | Master SKU: loại hạn (賞味/消費), ngưỡng cận hạn, lane truy xuất | SCR-02, FE-01, FE-13 | 2026-11-30 | 2026-12-11 | M-04 | E-02-S01 |
| E-02-S03 | Story | Phiên bản cấu hình + change request maker-checker (ADR-004) | FE-04 | 2026-11-30 | 2026-12-11 | M-04 | E-01-S03 |
| E-02-S04 | Story | Hợp đồng khách-SKU: chốt delivery window 1/3 · 1/2 · chỉ hạn nhãn | SCR-03, FE-02, FE-17 | 2026-12-14 | 2026-12-25 | M-04 | E-02-S03, Q5 |
| E-02-S05 | Story | Lịch sử giao theo khách (DR-HIST-01) | SCR-03 (S10) | 2027-01-18 | 2027-01-29 | M-04 | E-05-S03 |
| E-03 | Epic | Nhập kho & kiểm hàng (= F02) | | 2026-12-14 | 2026-12-25 | M-04 | |
| E-03-S01 | Story | Tạo & kiểm phiếu nhập: nhiệt / lô / hạn / vị trí đúng dải | SCR-07, FE-06 | 2026-12-14 | 2026-12-25 | M-04 | E-02-S02, E-04-S03 |
| E-03-S02 | Story | Lệch nhiệt → Từ chối hoặc 保留 vào 隔離 (-Q) | SCR-07, FE-07 | 2026-12-14 | 2026-12-25 | M-04 | E-03-S01 |
| E-03-S03 | Story | Truy xuất pháp định khi nhập: gạo 産地・取引, bò mã 10 số (9 số → business-review) | SCR-07, FE-34 | 2026-12-14 | 2026-12-25 | M-04 | E-03-S01, Q3 |
| E-03-S04 | Story | Danh sách & chi tiết phiếu nhập | SCR-07 | 2026-12-14 | 2026-12-25 | M-04 | E-03-S01 |
| E-03-S05 | Story | Appointment nhập + cảnh báo trùng tham chiếu NCC (tạm) | FE-05 | TBD (chờ đặc tả) | TBD | M-04 | E-03-S01 |
| E-04 | Epic | Tồn kho, 隔離 & ngưỡng nhiệt (= F03) | | 2026-11-30 | 2026-12-25 | M-04 | |
| E-04-S01 | Story | Ngưỡng 3 dải nhiệt có phiên bản (Yuki tự công bố) | SCR-32 | 2026-11-30 | 2026-12-11 | M-04 | E-02-S03 |
| E-04-S02 | Story | Tồn kho đa tiêu chí + cận hạn / quá hạn | SCR-08, FE-12 | 2026-12-14 | 2026-12-25 | M-04 | E-03-S01 |
| E-04-S03 | Story | Sổ di chuyển tồn, cấm tồn âm / ngoài dải | FE-09 | 2026-12-14 | 2026-12-25 | M-04 | E-02-S01 |
| E-04-S04 | Story | 隔離: release về vị trí thường cùng dải / scrap | SCR-10, FE-10 | 2026-12-14 | 2026-12-25 | M-04 | E-03-S02 |
| E-04-S05 | Story | Vị trí & put-away gợi ý; blind count duyệt 2 cấp (tạm) | FE-08, FE-11 | TBD (chờ đặc tả) | TBD | M-04 | E-04-S03 |
| E-05 | Epic | Xuất kho, allocation & kiểm trước xuất (= F05) | | 2027-01-04 | 2027-01-15 | M-04 | |
| E-05-S01 | Story | Danh sách đơn xuất + kiểm trước theo chuỗi | SCR-12, FE-18 | 2027-01-04 | 2027-01-15 | M-04 | E-02-S04 |
| E-05-S02 | Story | Allocation chuỗi loại trừ ①消費期限 ②dải ③隔離 ④window ⑤日付逆転 → FEFO/FIFO | SCR-13, FE-14, FE-15, FE-16, FE-19 | 2027-01-04 | 2027-01-15 | M-04 | E-02-S04, E-04-S01, E-04-S04, E-03-S01, Q1, Q2 |
| E-05-S03 | Story | Kiểm trước xuất & xác nhận giao (nhiệt dải lạnh nhất, lịch sử giao bất biến) | SCR-15, FE-21 | 2027-01-04 | 2027-01-15 | M-04 | E-05-S02 |
| E-06 | Epic | Cảnh báo 日付逆転 & maker-checker (= F05/F01) | | 2027-01-04 | 2027-01-15 | M-04 | |
| E-06-S01 | Story | Màn cảnh báo 日付逆転 trước khi giao | SCR-05 | 2027-01-04 | 2027-01-15 | M-04 | E-05-S02 |
| E-06-S02 | Story | Đề nghị ngoại lệ & duyệt (người lập ≠ người duyệt) | SCR-05, FE-04 | 2027-01-04 | 2027-01-15 | M-04 | E-05-S03, Q4 |
| E-06-S03 | Story | Nhật ký ngoại lệ bất biến (BR-DATE-01 / BR-EXP-02) | SCR-05, FE-14 | 2027-01-04 | 2027-01-15 | M-04 | E-05-S03 |
| E-07 | Epic | Truy xuất & recall (= F08) | | 2027-01-18 | 2027-01-29 | M-04 | |
| E-07-S01 | Story | Truy xuôi / ngược (lô ↔ khách ↔ NCC ↔ phiếu nhập) | SCR-27, FE-33 | 2027-01-18 | 2027-01-29 | M-04 | E-05-S03, E-03-S03 |
| E-07-S02 | Story | Recall case + đối soát số lượng (tạm) | FE-35 | TBD (chờ đặc tả) | TBD | M-04 | E-07-S01 |
| E-07-S03 | Story | Thông báo recall có version + approver (tạm) | FE-36 | TBD (chờ đặc tả) | TBD | M-04 | E-07-S02 |
| E-08 | Epic | Dashboard & báo cáo (= F09) | | 2027-01-18 | 2027-01-29 | M-04 | |
| E-08-S01 | Story | Tổng quan vận hành (KPI) | SCR-01 | 2027-01-18 | 2027-01-29 | M-04 | E-05-S02, E-06-S02 |
| E-08-S02 | Story | 12 báo cáo vận hành + dashboard KPI chuẩn (tạm) | FE-37, FE-39 | TBD (chờ đặc tả) | TBD | M-04 | E-08-S01 |
| E-08-S03 | Story | Audit export + manifest checksum (tạm) | FE-38 | TBD (chờ đặc tả) | TBD | M-04 | E-01-S03 |
| E-09 | Epic | POD 車上渡し / 軒先渡し & trả hàng (= F05 phần POD, tạm) | | TBD | TBD | M-04 | |
| E-09-S01 | Story | Pick & kiểm tải barcode / seal (tạm) | FE-20 | TBD (chờ chốt thiết bị) | TBD | M-04 | E-05-S02 |
| E-09-S02 | Story | POD theo điều kiện giao, ảnh hash, queue offline ≤ 8h (tạm) | FE-22 | TBD (chờ chốt thiết bị) | TBD | M-04 | E-05-S03 |
| E-09-S03 | Story | Trả hàng / khiếu nại (tạm) | FE-23 | TBD (chờ đặc tả) | TBD | M-04 | E-09-S02 |
| E-10 | Epic | Lập tuyến & giờ lái 2024 (= F06, tạm — **chưa có thiết kế chi tiết**; story chia theo ràng buộc giờ lái 2024 của RFP) | | TBD | TBD | M-04 | |
| E-10-S01 | Story | Lập tuyến từ đơn / dải nhiệt xe / khung giờ / service time / giờ depot; đơn chưa gán hiển thị lý do (tạm) | FE-24, SCR-18 | TBD (chờ IF-MAP-01 + đặc tả F06) | TBD | M-03, M-04 | Đặc tả chi tiết F06 hoàn thành trước M-03 (2026-11-27), Q-02 (license mapping), E-05-S01 |
| E-10-S02 | Story | Bản quy tắc giờ lái có phiên bản & ngày hiệu lực, số do Yuki công bố: 超勤 960h/năm · 拘束 3.300h/năm, 284h/tháng, 13h/ngày (tối đa 15h) · nghỉ ≥ 9h (mục tiêu 11h) · lái TB 9h/ngày (2 ngày), 44h/tuần (2 tuần) · lái liên tục ≤ 4h (tạm) | FE-25, FR-SCH-02 | TBD (chờ đặc tả F06) | TBD | M-04 | E-02-S03 (cơ chế phiên bản cấu hình, ADR-004), rà soát nguồn luật 2024 trước design freeze (OPS-LAW-01, DoD D-018) |
| E-10-S03 | Story | Kiểm ràng buộc **trong ngày** khi lập tuyến: 拘束 ≤ 13h (tối đa 15h), nghỉ giữa ca ≥ 9h, lái liên tục ≤ 4h → tự chèn nghỉ, hiển thị vị trí / thời lượng nghỉ (tạm) | FE-25, FR-SCH-02, FR-SCH-03 | TBD (chờ đặc tả F06) | TBD | M-04 | E-10-S01, E-10-S02 |
| E-10-S04 | Story | Kiểm ràng buộc **lũy kế theo kỳ**: lái TB 9h/ngày (2 ngày), 44h/tuần (2 tuần), 拘束 284h/tháng & 3.300h/năm, 超勤 960h/năm — cộng giờ đã làm thực tế của tài xế với tuyến định publish (tạm) | FE-25, FR-SCH-02 | TBD (chờ đặc tả F06 + nguồn giờ làm thực tế) | TBD | M-04 | E-10-S02, nguồn dữ liệu giờ làm thực tế của tài xế (chưa xác định) |
| E-10-S05 | Story | Bảng kiểm giờ lái (拘束 / 連続): vi phạm → **cấm publish** và nêu chính xác khoảng giờ vi phạm (tạm) | FE-25, SCR-19, US-06 | TBD (chờ đặc tả F06) | TBD | M-04 | E-10-S03, E-10-S04 |
| E-10-S06 | Story | Publish tuyến có version (gắn version bản quy tắc), đổi sau publish cần lý do, tài xế nhận bản mới nhất / itinerary (tạm) | FE-26, SCR-20, SCR-21, FR-SCH-04, DR-ROUTE-01 | TBD (chờ đặc tả F06) | TBD | M-04 | E-10-S05 |
| E-10-S07 | Story | Ghi sự cố (tai nạn / hỏng xe / thiên tai) riêng, bất biến, không ghi đè kết quả tuân thủ (tạm) | FE-27, FR-SCH-05 | TBD (chờ đặc tả F06) | TBD | M-04 | E-10-S06 |
| E-11 | Epic | Giám sát nhiệt logger & HACCP (= F07, tạm) | | TBD | TBD | M-04 | |
| E-11-S01 | Story | Import CSV logger (hash, timezone) + đánh giá reading theo ngưỡng phiên bản (tạm) | FE-28, FE-29 | TBD (chờ định dạng CSV) | TBD | M-04 | Q-04 (CSV logger), E-04-S01 |
| E-11-S02 | Story | Alarm SLA 15′ + deviation case / corrective action (tạm) | FE-30, FE-31 | TBD (chờ đặc tả) | TBD | M-04 | E-11-S01 |
| E-11-S03 | Story | Completeness HACCP (tạm) | FE-32 | TBD (chờ đặc tả) | TBD | M-04 | E-11-S01 |
| E-12 | Epic | Tích hợp & trao đổi file (= F10, tạm) | | TBD | TBD | M-04 | |
| E-12-S01 | Story | Nhận đơn ERP qua SFTP CSV (schema version, idempotency) (tạm) | FE-40 | TBD (chờ IF-ERP-01) | TBD | M-04 | Q-01 (đặc tả ERP), E-05-S01 |
| E-12-S02 | Story | Mail relay cho cảnh báo / duyệt + archive export manifest (tạm) | FE-42 | TBD (chờ đặc tả) | TBD | M-04 | E-06-S02, E-08-S03 |
| E-12-S03 | Story | Theo dõi import / export file (tạm) | SCR-36 | TBD (chờ đặc tả) | TBD | M-04 | E-12-S01 |
| E-13 | Epic | Bản địa hóa & khả năng truy cập (= F11 phần NFR có giao diện, tạm) | | TBD | TBD | M-04 | |
| E-13-S01 | Story | Giao diện tiếng Nhật + JST + WCAG 2.2 AA (tạm) | FE-45 | TBD (chờ đặc tả) | TBD | M-04 | E-01-S01 |

**Effort theo Epic** (nguồn sheet `07` + `04` của LAB-1; dùng để kiểm tải sprint, chưa phải phân bổ theo story):

| Epic | Màn hình (MD) | Engine (MD) | Ghi chú |
| --- | --- | --- | --- |
| Lõi LAB-4 (E-01 S01–S03, E-02, E-03 S01–S04, E-04 S01–S04, E-05, E-06, E-07-S01, E-08-S01) | 81,5 (14 màn) | 54 (ENG-01, 02, 03, 07) + một phần ENG-06, ENG-10 | ≈ 135,5 MD + phần chia, xếp vào S1–S4 |
| E-10 Lập tuyến & giờ lái 2024 (tách riêng vì ràng buộc 2024) | 27 (SCR-18 C 9 · SCR-19 C 9 · SCR-20 M 4,5 · SCR-21 M 4,5) | 18 (ENG-04: engine kiểm giờ lái + version rule) | **45 MD theo estimate LAB-1. Estimate chưa tách riêng:** (a) lấy giờ làm thực tế của tài xế để tính lũy kế tháng / năm / 2 tuần (E-10-S04) — nguồn dữ liệu chưa xác định; (b) bộ fixture kiểm thử biên cho ACC-SCH-01 (lịch thường / bất khả thi / nghỉ / sự cố). Phân bổ theo story **đã được PM duyệt (2026-10-03)**: S01 9 · S02 3 · S03 5 · S04 6 · S05 13 · S06 9 · S07 0 (nằm trong màn publish) = 45 MD. Phần (a)(b) **chưa ước lượng**, bổ sung khi có đặc tả F06 |
| Phần tạm còn lại (E-09, E-11…E-13 + story tạm của E-01, E-03, E-04, E-07, E-08) | 135 (23 màn) | 76 (ENG-05, 08, 09 + phần còn lại ENG-06, ENG-10) | ≈ 211 MD (cộng E-10 là ≈ 256 MD), **chưa xếp ngày** vì chưa có đặc tả. Dồn hết vào S5–S6 sẽ vượt tải (~128 MD/sprint so với bình quân ~65 MD/sprint của cả build 391,5 MD / 6 sprint) → phải chạy song song từ S2–S3, tức đặc tả cần có trước M-03 |

**Cross-cutting notes**: IT/ST/UAT, NFR workstream (FE-44 hiệu năng / BCP / observability), data migration (F12 — FE-46, FE-47), hạ tầng / CI-CD, đào tạo, hypercare, PM/PMO là **dòng pha ở §1**, không phải Epic. Cập nhật tài liệu `yccms/docs/` chạy song song mọi sprint (DoD của từng story). Lộ trình kỹ thuật P0–P5 trong `yccms/docs/development-roadmap.md` tương ứng: P1 ≈ S1–S2 (E-01, E-02, E-04-S01), P2 ≈ S2 (E-03, E-04), P3 ≈ S3 (E-05, E-06), P4 ≈ S4 (E-07-S01, E-08-S01, E-02-S05).

## 4. Revision History

| Date | Updated by | Content |
| --- | --- | --- |
| 2026-10-03 | pm-plan-schedule skill | Tạo baseline dự thảo v0.1: 11 mốc, 13 Epic / 45 Story (24 story lõi LAB-4 có ngày sprint, 21 story tạm TBD). Nguồn: LAB-4 (phạm vi), RFP (mốc), LAB-1 sheet 07/04 (effort) |
| 2026-10-03 | pm-plan-schedule skill | E-10 (F06) chia lại theo ràng buộc giờ lái 2024: 4 → 7 story (bản quy tắc có phiên bản, kiểm trong ngày, kiểm lũy kế theo kỳ, chặn publish, version tuyến, sự cố). Tách effort E-10 = 45 MD (LAB-1) và nêu phần estimate chưa tách riêng. Ghi nhận thiết kế chi tiết chưa có module lập lịch giao hàng; ngày vẫn TBD |
| 2026-10-03 | pm-plan-schedule skill | PM duyệt cập nhật E-10: phân bổ 45 MD theo 7 story; thêm phụ thuộc đặc tả chi tiết F06 trước M-03 và rà soát luật 2024 (OPS-LAW-01) cho E-10-S02 |
| 2026-10-03 | pm-plan-schedule skill | PM duyệt toàn bộ lịch làm baseline v1.0 (trước đó: bản nháp v0.1) |
