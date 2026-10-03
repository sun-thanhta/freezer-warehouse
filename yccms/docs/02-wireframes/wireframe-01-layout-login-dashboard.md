# Wireframe 1/4 — Bố cục chung, Đăng nhập, Tổng quan

## Cách đọc wireframe

- Khung vẽ cho màn PC rộng ≥ 1024px. Bản điện thoại ghi chú riêng ở cuối mỗi màn.
- `[n]` là số phần tử, khớp cột **No.** trong bảng đặc tả của màn đó (`03-detail-design/`).
- `( )` radio · `[▼]` select · `[____]` ô nhập · `[ Nút ]` nút bấm · `‹badge›` nhãn trạng thái · `▸` liên kết.
- Màu (ghi bằng chữ): **đỏ** = chặn/lỗi, **cam** = cảnh báo, **tím** = 隔離/chờ duyệt, **xanh lá** = đạt, **xanh dương** = thông tin/gợi ý.
- Nhãn ghi tiếng Việt như prototype; bản đích dịch sang tiếng Nhật theo bảng nhãn trong đặc tả.

## WF-L — Khung chung sau đăng nhập

```
┌──────────────────────┬────────────────────────────────────────────────────────────────────┐
│ [L1] PROTOTYPE       │ [L5] Tiêu đề trang                                    [L6] Nút chính │
│      YCCMS           │      Phụ đề: mã SCR · quy tắc nghiệp vụ áp dụng                       │
│      ユキコールド…    ├────────────────────────────────────────────────────────────────────┤
│──────────────────────│                                                                    │
│ [L2] VẬN HÀNH        │ [L7] Vùng thông báo (thành công: xanh lá · lỗi: đỏ · role: cam)      │
│  Tổng quan    SCR-01 │                                                                    │
│  Nhập kho…    SCR-07 │ [L8] Nội dung trang                                                 │
│  Xuất kho…  SCR-13/12│                                                                    │
│  Cảnh báo 日付逆転    │      Trạng thái chung của vùng nội dung:                            │
│               SCR-05 │        • Đang tải  → khối nhấp nháy "Đang tải dữ liệu từ Supabase…" │
│  Tồn kho & 隔離       │        • Lỗi       → hộp đỏ + nút [ Thử lại ]                       │
│            SCR-10/08 │        • Rỗng      → "Chưa có …" màu xám                            │
│ KHÁCH HÀNG & TRUY XUẤT│                                                                    │
│  Hợp đồng KH-SKU     │                                                                    │
│  Truy xuất    SCR-27 │                                                                    │
│ QUẢN TRỊ             │                                                                    │
│  Ngưỡng nhiệt & SKU  │                                                                    │
│  Audit log    SCR-34 │                                                                    │
│──────────────────────│                                                                    │
│ [L3] 田中 (Quản lý)  │                                                                    │
│      quanly@…        │                                                                    │
│      Quản lý         │                                                                    │
│ [L4] [ Đăng xuất ]   │                                                                    │
└──────────────────────┴────────────────────────────────────────────────────────────────────┘
```

Điện thoại (< 1024px): menu trái thu thành thanh trên cùng `YCCMS · Yuki  [ Menu ]`, bấm thì mở danh sách. Bảng rộng cuộn ngang trong khung của nó, trang không cuộn ngang.

## WF-00 — Đăng nhập (SCR-00)

```
┌────────────────────────────────────────────────────────────────┐
│                     (nền xanh đậm)                             │
│              YCCMS — Yuki Cold-Chain Management                │
│              ユキコールドロジスティクス                          │
│        ┌──────────────────────────────────────────┐            │
│        │ Email                                    │            │
│        │ [1] [________________________________]   │            │
│        │ Mật khẩu                                 │            │
│        │ [2] [________________________________]   │            │
│        │ [3] ┌──────────────────────────────────┐ │            │
│        │     │ ⚠ Sai email hoặc mật khẩu.        │ │ ← chỉ hiện │
│        │     └──────────────────────────────────┘ │   khi lỗi  │
│        │ [4] [          Đăng nhập           ]     │            │
│        │ [5] Tài khoản demo: xem README.md        │            │
│        └──────────────────────────────────────────┘            │
└────────────────────────────────────────────────────────────────┘
```

Bản đích (SSO): thay [1][2][4] bằng một nút `[ 社内アカウントでログイン ]` chuyển sang IdP. [3] vẫn giữ để báo lỗi cấu hình/kết nối.

## WF-01 — Tổng quan vận hành (SCR-01)

Số trên thẻ KPI [4] và [5] là giá trị thật của bộ seed ngay sau `npm run db:seed`, ngày làm việc 2026/10/03. Khung [6] vẽ trạng thái **sau khi chạy demo**; ngay sau seed khung này chỉ có 1 dòng `seed.load · system`.

```
┌─ [1] Tổng quan vận hành ───────────────────────────── [2][ + Phiếu nhập ] [3][ Xuất kho ] ┐
│      Ngày làm việc 2026/10/03 (giờ Nhật)                                                  │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│ [4] Thẻ KPI (bấm thẻ → màn liên quan)                                                       │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐        │
│ │Đơn xuất đang mở  │ │Dòng bị chặn      │ │Chờ duyệt ngoại lệ│ │Hợp đồng chưa chốt│        │
│ │      5   (xanh)  │ │日付逆転  1  (đỏ) │ │      0   (tím)   │ │window   2  (cam) │        │
│ │7 lô bị loại theo │ │Không còn lô hợp  │ │Maker-checker     │ │Business-review,  │        │
│ │chuỗi FR-OUT-02   │ │lệ                │ │                  │ │không áp mặc định │        │
│ └───── 4a ─────────┘ └───── 4b ─────────┘ └───── 4c ─────────┘ └───── 4d ─────────┘        │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐        │
│ │Lô đang 隔離      │ │Lô 消費期限 đã đến│ │Lô cận hạn        │ │Nhiệt lệch khi    │        │
│ │      1   (tím)   │ │      1   (đỏ)    │ │      2   (cam)   │ │nhận (7 ngày) 2   │        │
│ │Khóa tồn, chờ QA  │ │Hard stop         │ │Theo ngưỡng SKU   │ │0 phiếu hôm nay   │        │
│ └───── 4e ─────────┘ └───── 4f ─────────┘ └───── 4g ─────────┘ └───── 4h ─────────┘        │
├──────────────────────────────────────────────┬────────────────────────────────────────────┤
│ [5] Nhật ký ngoại lệ (7 ngày)                │ [6] Thao tác gần đây       ▸ Xem audit log  │
│    ┌──────────┐      ┌──────────┐            │  inbound.confirm · kho@…      10/03 09:12  │
│    │  0 (đỏ)  │      │  0 (tím) │            │  override.request · kho@…     10/03 09:20  │
│    │Lượt bị   │      │Ngoại lệ  │            │  outbound.ship · quanly@…     10/03 09:31  │
│    │chặn      │      │đã duyệt  │            │  … (6 dòng mới nhất)                       │
│    └── 5a ────┘      └── 5b ────┘            │                                            │
│ 5c: 日付逆転 so với hạn đã giao cho chính     │                                            │
│     cặp khách-SKU — không so với hôm nay.    │                                            │
└──────────────────────────────────────────────┴────────────────────────────────────────────┘
```

Điện thoại: thẻ KPI xếp 2 cột; [5] và [6] xếp dọc.
