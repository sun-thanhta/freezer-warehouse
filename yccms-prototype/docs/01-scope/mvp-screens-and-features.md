# MVP prototype YCCMS — danh sách màn hình & tính năng (bản chốt)

> Khách hàng (mô phỏng): ユキコールドロジスティクス株式会社 · Vendor: Sun VN02 · 2026-10-03
> Đầu vào: **LAB-1 bản v2 theo RFP thật** `YCL-RFP-2026-01 v2.0` (12 function · 47 feature · 41 màn hình · 12 user story · 88 yêu cầu).
> Mục tiêu prototype: cho khách **bấm thử được** hai nghiệp vụ lõi — **kiểm hàng nhập/xuất** và **cảnh báo/chặn 日付逆転** — đúng các quy tắc RFP, trên dữ liệu mock (fixture RFP) nằm trong Supabase thật.

## 1. Nguyên tắc chọn phạm vi

1. Dựng trọn **chuỗi nghiệp vụ nhập → tồn → allocation → giao** vì đây là nơi RFP gom nhiều quy tắc cứng nhất (FR-OUT-02, BR-EXP, BR-FEFO, BR-DATE, BR-DELWIN, BR-TEMP, FR-INV-05).
2. Dùng **đúng fixture của RFP**: 12 SKU (R-02), 15 hợp đồng khách-SKU (R-04, có AGR-008/014 chưa chốt), bố trí kho + khu 隔離 (R-01), ca kiểm thử CUS-003/CHI-002 (R-06).
3. Mỗi "lỗi nghiêm trọng bị trừ điểm" của RFP (S5-03) phải **thấy được trên màn hình**: không nhầm 賞味/消費, không so 日付逆転 với hôm nay, không gọi 1/3 là luật.
4. Phần phụ thuộc 3 điểm Assumption (ERP IF-ERP-01, mapping service IF-MAP-01, IdP/OIDC IF-IDP-01) hoặc phần cứng (handy terminal, thiết bị tài xế) thì **để ngoài**.

## 2. Màn hình đã dựng (14 mã SCR của workbook v2, kèm trang cảnh báo 日付逆転 và lịch sử giao theo khách không có mã riêng)

| URL prototype | Mã v2 | Tên màn hình | Quy tắc / US thể hiện |
|---|---|---|---|
| `/login` | SCR-00 | Đăng nhập | Người lạ mở URL nào cũng về đây (SSO/OIDC được thay bằng Supabase Auth — xem tài liệu mock) |
| `/` | SCR-01 | Dashboard vận hành | Đơn mở, dòng bị chặn 日付逆転, đề nghị chờ duyệt, hợp đồng chưa chốt window, lô 隔離, lô 消費期限 đã đến |
| `/inbound`, `/inbound/new`, `/inbound/[id]` | SCR-07 | Kiểm nhập (nhiệt/lô/hạn) | FR-REC-02..05: nhiệt so ngưỡng Yuki (冷蔵 0–5°C…); lệch nhiệt → **chỉ được Từ chối hoặc 保留 → khu 隔離 (-Q)** kèm ghi chú; 消費期限 đã đến khi nhận → không nhập; gạo bắt buộc 産地・取引; bò bắt buộc **mã đúng 10 số** (9 số → business-review, không tự làm tròn) |
| `/inventory` | SCR-08 + SCR-10 | Tồn kho đa tiêu chí · 隔離 / release / scrap | Lọc theo dải nhiệt, cận hạn, 隔離; quản lý release lô 隔離 về vị trí thường cùng dải hoặc scrap, có lý do + audit |
| `/outbound` | SCR-12 | Đơn xuất | Mỗi đơn được kiểm trước: dòng bị chặn, lô bị loại, hợp đồng chưa chốt, đề nghị chờ duyệt |
| `/outbound/[id]` | SCR-13 + SCR-15 | **Allocation (chuỗi loại trừ) & FEFO** · kiểm trước xuất | US-01/US-05: ① 消費期限 → ② sai dải → ③ 隔離 → ④ delivery window → ⑤ 日付逆転 → FEFO, cùng hạn thì FIFO. Mỗi lô hiện **mọi** quy tắc nó vi phạm; mốc 日付逆転 của đúng cặp khách-SKU; ghi nhiệt khi xuất theo dải lạnh nhất của đơn |
| `/alerts` | SCR-05 (+ màn bổ sung "cảnh báo 日付逆転") | **Cảnh báo 日付逆転** · hàng chờ duyệt maker-checker | US-02: đơn sắp giao bị chặn; đề nghị ngoại lệ (người lập ≠ người duyệt, NFR-SEC-02); nhật ký ngoại lệ bất biến BR-DATE-01 / BR-EXP-02 |
| `/customers` | SCR-03 | Hợp đồng khách-SKU | US-04: delivery window ONE_THIRD / ONE_HALF / LABEL_DATE_ONLY theo từng hợp đồng; AGR-008/014 hiển thị "chưa chốt → business-review", chỉ quản lý chốt được, có audit |
| `/customers/[id]` | (DR-HIST-01) | Lịch sử giao theo khách | Nền của 日付逆転; đánh dấu mốc từng SKU |
| `/settings` | SCR-32 + SCR-02 | Ngưỡng nhiệt · master 12 SKU | BR-TEMP-01: ngưỡng do Yuki tự công bố; BR-EXP-01: loại hạn theo SKU, lane truy xuất |
| `/trace` | SCR-27 | Truy vết xuôi/ngược | FR-TRC-01: lô → khách đã nhận; khách → lô → NCC → phiếu nhập; 3 lane (米/牛/nội bộ) |
| `/audit` | SCR-34 | Audit log append-only | NFR-AUD-01: người thực hiện do server đóng dấu |

Vai trò demo: `warehouse` (nhân viên kho) và `manager` (quản lý). Quản lý mới được: duyệt đề nghị ngoại lệ của **người khác**, chốt delivery window, sửa ngưỡng nhiệt / loại hạn, release/scrap lô 隔離.

## 3. Tính năng & user story v2 có trong prototype

| Feature | Mức độ | Ghi chú |
|---|---|---|
| FE-01 Master SKU (dải, loại hạn, lane) | Một phần | Xem + sửa loại hạn/ngưỡng cận hạn; chưa CRUD SKU |
| FE-02 Hợp đồng khách-SKU | Đầy đủ (window) | Chưa có effective-dating nhiều phiên bản |
| FE-04 Maker-checker | Một phần | Áp cho ngoại lệ 日付逆転; chưa áp cho thay đổi master |
| FE-06 / FE-07 Kiểm nhập, nhận/từ chối/保留 → 隔離 | Đầy đủ (trừ ảnh) | Chưa chụp ảnh, chưa appointment; ngày nhận chỉ trong 7 ngày gần nhất (JST), không ở tương lai |
| FE-09 Cấm tồn âm / ngoài dải | Một phần | Ràng buộc DB + kiểm vị trí đúng dải; chưa ghi lịch sử di chuyển |
| FE-10 State machine 隔離 | Đầy đủ | available → quarantine → release / scrap |
| FE-12 Tìm tồn đa tiêu chí | Đầy đủ | |
| FE-13 / FE-14 2 loại hạn, hard stop 消費期限 + exception bất biến | Đầy đủ | |
| FE-15 FEFO (cùng hạn → FIFO), loại lô 隔離 | Đầy đủ | |
| FE-16 日付逆転 theo cặp khách-SKU | Đầy đủ | Chốt chặn 2 lớp: API + hàm SQL; khóa theo khách × SKU khi giao đồng thời |
| FE-17 Delivery window theo hợp đồng, dòng chưa chốt = business-review | Đầy đủ | |
| FE-19 Allocation nguyên tử theo chuỗi 6 bước | Đầy đủ | |
| FE-21 Kiểm trước xuất | Một phần | Nhiệt hàng; chưa nhiệt xe / seal / giờ |
| FE-33 / FE-34 Truy vết, 3 lane | Một phần | Có truy xuôi/ngược + kiểm mã gạo/bò khi nhập; chưa chỉ điểm đứt liên kết |
| FE-43 RBAC + audit append-only | Một phần | 2 vai trò; không SSO/MFA |

User story phủ: **US-01, US-02, US-03, US-04, US-05** đầy đủ; **US-08** (phần truy xuất 3 lane, chưa recall); **US-11** (RBAC + maker-checker, chưa SSO/MFA).

## 4. Để lại ngoài phạm vi so với LAB-1 v2 — và vì sao

| Nhóm / màn hình v2 | Lý do để ngoài | Khi nào |
|---|---|---|
| **F06 Lập tuyến & giờ lái** (SCR-18..21, FE-24..27, US-06) | Engine riêng (960h/3.300h/284h/13–15h/nghỉ 9h/lái liên tục ≤ 4h, cấm publish khi vi phạm) và phụ thuộc mapping service (IF-MAP-01 còn là Assumption) | Prototype vòng 2 |
| **F07 Giám sát nhiệt logger & HACCP** (SCR-22..26, FE-28..32, US-07) | Cần định dạng CSV logger DL-A01/C01/F01 và nhịp HACCP của Yuki; nhiệt lúc nhận/xuất đã có | Vòng 2 |
| **Recall** (SCR-28, 29; FE-35, 36) | Công thức đối soát affected = on-hand + shipped = returned + unresolved + disposed cần luồng trả hàng | Vòng 2 |
| **POD 車上渡し / 軒先渡し** (SCR-16, FE-22, US-09) | Ứng dụng tài xế trên thiết bị quản lý, hàng đợi offline ≤ 8h; điều kiện giao đã hiển thị trên hợp đồng | Giai đoạn chính thức |
| Pick & kiểm tải barcode/seal (SCR-14, FE-20) | Cần handy terminal / máy quét | Giai đoạn chính thức |
| Trả hàng / khiếu nại (SCR-17), appointment (SCR-06), put-away gợi ý (SCR-09), blind count (SCR-11) | Không thuộc hai nghiệp vụ lõi của demo | Giai đoạn chính thức |
| Master NCC/vị trí/device (SCR-04), maker-checker cho master (SCR-05 phần master) | Master đã đổ sẵn; CRUD chuẩn, ít rủi ro | Giai đoạn chính thức |
| Trung tâm 12 báo cáo (SCR-30), audit export có manifest (SCR-31) | Danh mục báo cáo và định dạng export cần chốt | Giai đoạn chính thức |
| Quản lý người dùng/RBAC (SCR-33), cấu hình interface ERP/logger/map/IdP/mail (SCR-35, 36), cấu hình hệ thống (SCR-40) | 2 tài khoản demo tạo bằng script; tích hợp thuộc 3 điểm Assumption | Giai đoạn chính thức |
| Migration (SCR-37..39, FE-46, 47, US-10) | Cần dữ liệu thật + 2 lần rehearsal | Giai đoạn chính thức |
| NFR: tải 80 người dùng, 300.000 dòng giao, BCP, WCAG 2.2 AA, giao diện tiếng Nhật | Không đo được trên prototype; UI hiện là tiếng Việt + thuật ngữ Nhật | Giai đoạn chính thức |

## 5. Kịch bản dữ liệu mock (ngày tương đối theo hôm nay, giờ Nhật)

| Đơn | Khách | Điều khách sẽ thấy |
|---|---|---|
| OUT-…-01 | CUS-001 | ④ lô gạo cũ quá 1/3 bị loại (AGR-001) → chọn lô mới; ② lô FRO-001-X đặt nhầm khu mát bị loại; bò CHI-001 (消費期限, AGR-002 1/2) |
| OUT-…-02 | CUS-002 | AMB-002 hai lô cùng hạn → lô nhập trước (FIFO); ① đậu phụ CHI-003-A đến 消費期限 hôm nay → hard stop |
| OUT-…-03 | CUS-003 | **⑤ CHI-002 bị CHẶN 日付逆転** (US-02: khách đã nhận lô hạn muộn hơn); ③ salad CHI-004-A đang 隔離; AGR-008 chưa chốt window |
| OUT-…-04 | CUS-004 | Đơn bình thường 3 dải nhiệt |
| OUT-…-05 | CUS-005 | CHI-002 lô cũ **được** giao vì CUS-005 chưa có lịch sử SKU này (không mượn lịch sử CUS-003); AGR-014 chưa chốt |

Kịch bản trình diễn từng bước: [../03-demo/demo-script-for-client.md](../03-demo/demo-script-for-client.md).
