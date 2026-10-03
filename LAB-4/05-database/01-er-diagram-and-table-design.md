# Sơ đồ cơ sở dữ liệu (thiết kế đích) — thực thể · quan hệ · PK/FK

> Thiết kế cho bản build, phạm vi các module lõi của LAB-4, có giữ chỗ cho ERP. Các điểm khác với bảng prototype đang chạy thật trên Supabase được đối chiếu ở [02-prototype-vs-design-comparison.md](02-prototype-vs-design-comparison.md).
> Ký hiệu ★ = bảng hoặc cột **không có** ở prototype.

## 1. Nguyên tắc thiết kế

| # | Nguyên tắc | Lý do |
|---|---|---|
| P1 | Master dùng khóa số (`int`/`smallint` identity), giao dịch dùng `uuid` | Master ít dòng, hay join, mã đọc được; giao dịch sinh ở nhiều nơi, không đoán được id |
| P2 | Mọi bảng có mã nghiệp vụ duy nhất (`code`, `sku`, `lot_no` theo SKU) ngoài khóa kỹ thuật | Người dùng và tích hợp ERP tra theo mã |
| P3 | Cấu hình làm đổi kết quả hard stop có **phiên bản theo ngày hiệu lực** | ADR-004, DR-MST-01, BR-TEMP-01 |
| P4 | Bảng sự kiện **bất biến**: `delivery_history`, `allocation_exceptions`, `audit_logs`, `inventory_movements` | DR-HIST-01, NFR-AUD-01; chặn UPDATE/DELETE bằng quyền **và** trigger |
| P5 | Người thực hiện luôn là FK tới `app_users`. Chỉ `audit_logs` giữ thêm bản chụp email | Toàn vẹn tham chiếu; audit phải đọc được kể cả khi tài khoản đổi email |
| P6 | Miền giá trị nhỏ, cố định dùng `CHECK`; danh mục người dùng sửa được thì dùng bảng | Đơn giản (KISS); vai trò là bảng vì cần gán nhiều-nhiều |
| P7 | Mọi FK có index ở phía con | Postgres không tự tạo index cho FK |
| P8 | Thời điểm lưu `timestamptz`; ngày nghiệp vụ lưu `date` theo JST | NFR-LOC-01; tránh lệch ngày 00:00–09:00 JST |

## 2. Tổng quan quan hệ

```mermaid
erDiagram
  app_users ||--o{ user_roles : has
  roles ||--o{ user_roles : grants
  temperature_zones ||--o{ temperature_zone_versions : "versioned by"
  temperature_zones ||--o{ locations : contains
  temperature_zones ||--o{ products : "stored in"
  products ||--o{ product_versions : "versioned by"
  customers ||--o{ customer_sites : has
  customers ||--o{ customer_sku_agreements : signs
  products ||--o{ customer_sku_agreements : "covered by"
  suppliers ||--o{ inbound_receipts : delivers
  inbound_receipts ||--|{ inbound_lines : contains
  inbound_lines ||--o{ inbound_attachments : evidences
  inbound_lines |o--o| lots : creates
  products ||--o{ lots : "stocked as"
  suppliers ||--o{ lots : supplies
  locations ||--o{ lots : holds
  lots ||--o{ lot_regulated_ids : "identified by"
  lots ||--o{ inventory_movements : moves
  erp_import_batches ||--o{ outbound_orders : imports
  customers ||--o{ outbound_orders : places
  customer_sites |o--o{ outbound_orders : "ships to"
  outbound_orders ||--|{ outbound_lines : contains
  outbound_lines ||--o{ outbound_allocations : "allocated by"
  lots ||--o{ outbound_allocations : "allocated from"
  outbound_orders ||--o{ shipment_temperature_checks : "checked by"
  outbound_allocations ||--o| delivery_history : "becomes"
  lots ||--o{ delivery_history : delivered
  customers ||--o{ delivery_history : received
  outbound_orders ||--o{ override_requests : "requests exception"
  override_requests ||--|{ override_request_items : contains
  outbound_orders ||--o{ allocation_exceptions : logs
  lots ||--o{ allocation_exceptions : "subject of"
  override_requests |o--o{ allocation_exceptions : justifies
  app_users ||--o{ change_requests : "requests / decides"
  app_users ||--o{ audit_logs : acts
```

## 3. Sơ đồ chi tiết theo nhóm

### 3.1 Người dùng, master, cấu hình

```mermaid
erDiagram
  app_users {
    uuid id PK "= auth.users.id (FK)"
    text email UK
    text full_name
    bool is_active
    timestamptz created_at
  }
  roles {
    text code PK "warehouse|manager|qa|sales|admin|auditor|driver|dispatcher"
    text name
  }
  user_roles {
    uuid user_id PK, FK
    text role_code PK, FK
    uuid granted_by FK
    timestamptz granted_at
  }
  temperature_zones {
    smallint id PK
    text code UK "ambient|chilled|frozen"
    text name
  }
  temperature_zone_versions {
    int id PK
    smallint zone_id FK
    numeric min_c "NULL = không giới hạn"
    numeric max_c "NULL = không giới hạn"
    date effective_from
    date effective_to "NULL = đang hiệu lực"
    uuid approved_by FK
  }
  locations {
    int id PK
    text code UK
    smallint zone_id FK
    bool is_quarantine "-Q"
    bool is_active
  }
  suppliers {
    int id PK
    text code UK
    text name
    bool is_active
  }
  customers {
    int id PK
    text code UK
    text name
    bool is_active
  }
  customer_sites {
    int id PK
    int customer_id FK
    text code UK
    text name
  }
  products {
    int id PK
    text sku UK
    text name
    text unit
    smallint zone_id FK
    text trace_lane "rice|beef|internal_lot"
    bool is_active
  }
  product_versions {
    int id PK
    int product_id FK
    text expiry_type "best_before|use_by"
    int near_expiry_days
    date effective_from
    date effective_to
    uuid approved_by FK
  }
  customer_sku_agreements {
    int id PK
    text code "AGR-xxx"
    int customer_id FK
    int product_id FK
    text delivery_term "軒先渡し|車上渡し"
    text window_rule "ONE_THIRD|ONE_HALF|LABEL_DATE_ONLY|NULL"
    date effective_from
    date effective_to
    uuid approved_by FK
  }
  change_requests {
    uuid id PK
    text entity
    text entity_id
    jsonb payload_before
    jsonb payload_after
    date effective_from
    text status "pending|approved|rejected|cancelled"
    uuid requested_by FK
    uuid decided_by FK
    text decision_note
  }
  app_users ||--o{ user_roles : has
  roles ||--o{ user_roles : grants
  temperature_zones ||--o{ temperature_zone_versions : versions
  temperature_zones ||--o{ locations : contains
  temperature_zones ||--o{ products : band
  products ||--o{ product_versions : versions
  customers ||--o{ customer_sites : has
  customers ||--o{ customer_sku_agreements : signs
  products ||--o{ customer_sku_agreements : covers
  app_users ||--o{ change_requests : requests
```

### 3.2 Nhập kho, tồn kho, truy xuất

```mermaid
erDiagram
  inbound_receipts {
    uuid id PK
    text code UK "IN-YYMMDD-nnnn"
    int supplier_id FK
    text supplier_ref "UK cùng supplier_id"
    date arrival_date "JST"
    text status "draft|confirmed"
    text idempotency_key UK
    text note
    uuid created_by FK
    timestamptz confirmed_at
  }
  inbound_lines {
    uuid id PK
    uuid receipt_id FK
    int product_id FK
    text lot_no
    date mfg_date
    date expiry_date
    int qty
    numeric temp_c
    bool temp_ok
    int zone_version_id FK "ngưỡng đã áp dụng"
    text temp_note
    int location_id FK
    text result "accepted|rejected|hold"
    text result_reason
  }
  inbound_attachments {
    uuid id PK
    uuid inbound_line_id FK
    text storage_path
    text sha256
    uuid uploaded_by FK
  }
  lots {
    uuid id PK
    int product_id FK
    int supplier_id FK
    uuid inbound_line_id FK, UK "NULL = lô migration"
    text lot_no "UK cùng product_id"
    date mfg_date
    date expiry_date
    int qty_received
    int qty_on_hand ">= 0"
    int location_id FK
    text status "available|quarantine|review|scrapped"
    timestamptz received_at
  }
  lot_regulated_ids {
    uuid id PK
    uuid lot_id FK
    text id_type "RICE_ORIGIN|RICE_TRADE|BEEF_INDIVIDUAL"
    text value
    text verification_status "ok|review"
  }
  inventory_movements {
    bigint id PK
    uuid lot_id FK
    text movement_type "receive|quarantine|release|scrap|ship|adjust|move"
    int qty_delta
    int from_location_id FK
    int to_location_id FK
    text reason
    text ref_entity
    text ref_id
    uuid actor_id FK
    timestamptz created_at
  }
  inbound_receipts ||--|{ inbound_lines : contains
  inbound_lines ||--o{ inbound_attachments : photos
  inbound_lines |o--o| lots : creates
  lots ||--o{ lot_regulated_ids : identifies
  lots ||--o{ inventory_movements : ledger
```

### 3.3 Xuất kho, ngoại lệ, lịch sử, audit

```mermaid
erDiagram
  erp_import_batches {
    uuid id PK
    text file_name
    text sha256 UK
    text schema_version
    text status "received|processed|rejected"
    int row_count
    int rejected_count
    timestamptz received_at
  }
  outbound_orders {
    uuid id PK
    text code UK
    int customer_id FK
    int site_id FK "NULL nếu giao theo khách"
    date ship_date
    text status "open|shipped|cancelled"
    text source "manual|erp"
    uuid erp_batch_id FK
    text erp_idempotency_key UK
    timestamptz shipped_at
    uuid shipped_by FK
  }
  outbound_lines {
    uuid id PK
    uuid order_id FK
    int product_id FK
    int qty
  }
  outbound_allocations {
    uuid id PK
    uuid order_line_id FK
    uuid lot_id FK
    int qty
    text status "planned|shipped"
    jsonb warnings "④ đã bỏ qua"
  }
  shipment_temperature_checks {
    uuid id PK
    uuid order_id FK
    smallint zone_id FK
    numeric temp_c
    text compartment
    text seal_no
    timestamptz measured_at
    uuid actor_id FK
  }
  delivery_history {
    uuid id PK
    int customer_id FK
    int site_id FK
    int product_id FK
    uuid lot_id FK
    uuid order_id FK "NULL = lịch sử migration"
    uuid allocation_id FK, UK
    int qty
    date expiry_date "chụp lúc giao"
    timestamptz delivered_at
  }
  override_requests {
    uuid id PK
    uuid order_id FK "UK khi status=pending"
    numeric ship_temp_c
    text reason
    text status "pending|approved|rejected|cancelled"
    uuid requested_by FK
    uuid decided_by FK
    text decision_note
    timestamptz expires_at
    timestamptz decided_at
  }
  override_request_items {
    uuid id PK
    uuid request_id FK
    uuid order_line_id FK
    uuid lot_id FK
    int qty
  }
  allocation_exceptions {
    uuid id PK
    text rule "BR-DATE-01|BR-EXP-02"
    uuid order_id FK
    int customer_id FK
    int product_id FK
    uuid lot_id FK
    date lot_expiry
    date reference_date
    text decision "blocked|overridden"
    text reason
    uuid override_request_id FK
    uuid actor_id FK
    uuid approver_id FK
    timestamptz created_at
  }
  audit_logs {
    bigint id PK
    uuid actor_id FK
    text actor_email "bản chụp"
    text action
    text entity
    text entity_id
    jsonb detail
    timestamptz created_at "partition theo tháng"
  }
  erp_import_batches ||--o{ outbound_orders : imports
  outbound_orders ||--|{ outbound_lines : contains
  outbound_lines ||--o{ outbound_allocations : allocated
  outbound_orders ||--o{ shipment_temperature_checks : checked
  outbound_allocations ||--o| delivery_history : becomes
  outbound_orders ||--o{ override_requests : requests
  override_requests ||--|{ override_request_items : contains
  outbound_orders ||--o{ allocation_exceptions : logs
  override_requests |o--o{ allocation_exceptions : justifies
```

## 4. Định nghĩa bảng

Cột chung không nhắc lại: `created_at timestamptz not null default now()` ở mọi bảng (trừ khi ghi khác); `updated_at` ở bảng master.

### 4.1 Người dùng & phân quyền

| Bảng | Cột chính | PK | FK | UK / CHECK / ghi chú |
|---|---|---|---|---|
| `app_users` ★ (thay `profiles`) | `id uuid`, `email text`, `full_name text`, `is_active bool` | `id` | `id → auth.users(id) on delete restrict` | UK `email`. Vô hiệu hóa bằng `is_active`, không xóa (giữ tham chiếu audit) |
| `roles` ★ | `code text`, `name text` | `code` | — | 8 dòng cố định |
| `user_roles` ★ | `user_id uuid`, `role_code text`, `granted_by uuid`, `granted_at` | (`user_id`, `role_code`) | `user_id → app_users`, `role_code → roles`, `granted_by → app_users` | Hàm `has_role(code)` thay `app_role()` |

### 4.2 Master & cấu hình

| Bảng | Cột chính | PK | FK | UK / CHECK / ghi chú |
|---|---|---|---|---|
| `temperature_zones` | `id smallint`, `code`, `name` | `id` | — | UK `code`; CHECK `code in (ambient, chilled, frozen)` |
| `temperature_zone_versions` ★ | `zone_id`, `min_c numeric(5,1)`, `max_c numeric(5,1)`, `effective_from date`, `effective_to date`, `approved_by` | `id` | `zone_id → temperature_zones`, `approved_by → app_users` | CHECK `min_c is not null or max_c is not null`, `min_c <= max_c`; EXCLUDE chồng `daterange(effective_from, effective_to)` theo `zone_id` |
| `locations` | `code`, `zone_id`, `is_quarantine`, `is_active` ★ | `id` | `zone_id → temperature_zones` | UK `code` |
| `suppliers` | `code`, `name`, `is_active` ★ | `id` | — | UK `code` |
| `customers` | `code`, `name`, `is_active` ★ | `id` | — | UK `code` |
| `customer_sites` ★ | `customer_id`, `code`, `name` | `id` | `customer_id → customers` | UK `code`. **[Chờ khách — Q1]** |
| `products` | `sku`, `name`, `unit`, `zone_id`, `trace_lane`, `is_active` ★ | `id` | `zone_id → temperature_zones` | UK `sku`; CHECK `trace_lane`. `expiry_type`, `near_expiry_days` chuyển sang `product_versions` |
| `product_versions` ★ | `product_id`, `expiry_type`, `near_expiry_days`, `effective_from`, `effective_to`, `approved_by` | `id` | `product_id → products`, `approved_by → app_users` | CHECK `expiry_type in (best_before, use_by)`, `near_expiry_days between 0 and 365`; EXCLUDE chồng khoảng |
| `customer_sku_agreements` | `code`, `customer_id`, `product_id`, `delivery_term`, `window_rule`, `effective_from`, `effective_to` ★, `approved_by` ★ | `id` | `customer_id → customers`, `product_id → products`, `approved_by → app_users` | UK (`customer_id`, `product_id`, `effective_from`); UK (`code`, `effective_from`); EXCLUDE chồng khoảng theo (`customer_id`, `product_id`); CHECK `window_rule` (NULL = chưa chốt), `delivery_term` |
| `change_requests` ★ | `entity`, `entity_id`, `payload_before jsonb`, `payload_after jsonb`, `effective_from`, `status`, `requested_by`, `decided_by`, `decision_note`, `decided_at` | `id uuid` | `requested_by`, `decided_by → app_users` | CHECK `decided_by <> requested_by`; index một phần `(entity, entity_id) where status='pending'` UK |

### 4.3 Nhập kho & tồn kho

| Bảng | Cột chính | PK | FK | UK / CHECK / ghi chú |
|---|---|---|---|---|
| `inbound_receipts` | `code`, `supplier_id`, `supplier_ref` ★, `arrival_date`, `status` ★, `idempotency_key` ★, `note`, `created_by`, `confirmed_at` ★ | `id uuid` | `supplier_id → suppliers`, `created_by → app_users` | UK `code`; UK (`supplier_id`, `supplier_ref`); UK `idempotency_key`; **không** đặt default cho `arrival_date` |
| `inbound_lines` | `receipt_id`, `product_id`, `lot_no`, `mfg_date`, `expiry_date`, `qty`, `temp_c`, `temp_ok`, `zone_version_id` ★, `temp_note`, `location_id`, `result`, `result_reason` ★ | `id uuid` | `receipt_id → inbound_receipts on delete cascade` (chỉ khi `draft`), `product_id`, `location_id`, `zone_version_id → temperature_zone_versions` | CHECK `expiry_date >= mfg_date`, `qty > 0`, `result`; CHECK `result='rejected' or location_id is not null`. Index `receipt_id` |
| `inbound_attachments` ★ | `inbound_line_id`, `storage_path`, `sha256`, `uploaded_by` | `id uuid` | `inbound_line_id → inbound_lines`, `uploaded_by → app_users` | File ở Supabase Storage (bucket riêng tư) |
| `lots` | `product_id`, `supplier_id`, `inbound_line_id`, `lot_no`, `mfg_date`, `expiry_date`, `qty_received`, `qty_on_hand`, `location_id`, `status`, `received_at` | `id uuid` | `product_id`, `supplier_id`, `inbound_line_id → inbound_lines`, `location_id → locations` | UK (`product_id`, `lot_no`); UK `inbound_line_id` (NULL được); CHECK `qty_on_hand >= 0`, `qty_on_hand <= qty_received`, `status in (available, quarantine, review, scrapped)`. Index (`product_id`, `expiry_date`, `received_at`), `location_id` |
| `lot_regulated_ids` ★ | `lot_id`, `id_type`, `value`, `verification_status` | `id uuid` | `lot_id → lots` | UK (`lot_id`, `id_type`); CHECK `id_type='BEEF_INDIVIDUAL'` ⇒ `value ~ '^[0-9]{10}$'` hoặc `verification_status='review'`; index (`id_type`, `value`) |
| `inventory_movements` ★ | `lot_id`, `movement_type`, `qty_delta`, `from_location_id`, `to_location_id`, `reason`, `ref_entity`, `ref_id`, `actor_id` | `id bigint` | `lot_id → lots`, `*_location_id → locations`, `actor_id → app_users` | Bất biến; `sum(qty_delta)` theo lô = `qty_on_hand` (kiểm bằng job đối soát) |

### 4.4 Xuất kho, ngoại lệ, lịch sử

| Bảng | Cột chính | PK | FK | UK / CHECK / ghi chú |
|---|---|---|---|---|
| `erp_import_batches` ★ | `file_name`, `sha256`, `schema_version`, `status`, `row_count`, `rejected_count`, `received_at` | `id uuid` | — | UK `sha256` (file trùng → reject). Dòng chi tiết ở `erp_import_rows` (khi có đặc tả IF-ERP-01) |
| `outbound_orders` | `code`, `customer_id`, `site_id` ★, `ship_date`, `status`, `source` ★, `erp_batch_id` ★, `erp_idempotency_key` ★, `shipped_at`, `shipped_by` | `id uuid` | `customer_id`, `site_id → customer_sites`, `erp_batch_id → erp_import_batches`, `shipped_by → app_users` | UK `code`; UK `erp_idempotency_key`; CHECK `status in (open, shipped, cancelled)`; CHECK `site_id` thuộc `customer_id` (trigger) |
| `outbound_lines` | `order_id`, `product_id`, `qty` | `id uuid` | `order_id → outbound_orders on delete cascade`, `product_id` | CHECK `qty > 0`; index `order_id` |
| `outbound_allocations` ★ | `order_line_id`, `lot_id`, `qty`, `status`, `warnings` | `id uuid` | `order_line_id → outbound_lines`, `lot_id → lots` | CHECK `qty > 0`; UK (`order_line_id`, `lot_id`) |
| `shipment_temperature_checks` ★ | `order_id`, `zone_id`, `temp_c`, `compartment`, `seal_no`, `measured_at`, `actor_id` | `id uuid` | `order_id`, `zone_id`, `actor_id` | Thay `outbound_orders.ship_temp_c` |
| `delivery_history` | `customer_id`, `site_id` ★, `product_id`, `lot_id`, `order_id`, `allocation_id` ★, `qty`, `expiry_date`, `delivered_at` | `id uuid` | `customer_id`, `site_id`, `product_id`, `lot_id`, `order_id`, `allocation_id → outbound_allocations` | UK `allocation_id`; CHECK `qty > 0`; index (`customer_id`, `product_id`, `expiry_date desc`), `lot_id`, (`customer_id`, `delivered_at`); trigger chặn UPDATE/DELETE |
| `override_requests` | `order_id`, `ship_temp_c`, `reason`, `status`, `requested_by`, `decided_by`, `decision_note`, `expires_at` ★, `decided_at` | `id uuid` | `order_id`, `requested_by`, `decided_by → app_users` | UK một phần `order_id where status='pending'`; CHECK `decided_by <> requested_by` |
| `override_request_items` ★ (thay cột `allocations jsonb`) | `request_id`, `order_line_id`, `lot_id`, `qty` | `id uuid` | `request_id → override_requests`, `order_line_id → outbound_lines`, `lot_id → lots` | CHECK `qty > 0` |
| `allocation_exceptions` | `rule`, `order_id`, `customer_id`, `product_id`, `lot_id`, `lot_expiry`, `reference_date`, `decision`, `reason`, `override_request_id` ★, `actor_id`, `approver_id` ★ | `id uuid` | `order_id`, `customer_id`, `product_id`, `lot_id`, `override_request_id → override_requests`, `actor_id`, `approver_id → app_users` | UK (`rule`, `order_id`, `lot_id`, `decision`); CHECK `decision='overridden'` ⇒ `override_request_id is not null`; bất biến |

### 4.5 Audit

| Bảng | Cột chính | PK | FK | Ghi chú |
|---|---|---|---|---|
| `audit_logs` | `actor_id`, `actor_email`, `action`, `entity`, `entity_id`, `detail jsonb`, `created_at` | `id bigint` | `actor_id → app_users` (NULL = system) | Partition theo tháng theo `created_at`; trigger chặn UPDATE/DELETE cho mọi role; giữ 3 năm (DR-RET-01) |

## 5. Hàm và trigger thuộc thiết kế

| Đối tượng | Vai trò |
|---|---|
| `has_role(text)` / `current_user_roles()` | Thay `app_role()`; dùng trong RLS và hàm SQL |
| `zone_range_at(zone_id, date)`, `product_rule_at(product_id, date)`, `agreement_at(customer_id, product_id, date)` ★ | Đọc phiên bản cấu hình có hiệu lực (ADR-004) |
| `last_deliveries(customer_ids, product_ids)` | Mốc 日付逆転 (giữ như prototype) |
| `confirm_inbound_receipt`, `resolve_quarantine`, `confirm_shipment`, `request_override`, `decide_override`, `_validate_shipment`, `_perform_shipment` | Giữ như prototype (ADR-001); đổi phần đọc cấu hình sang hàm `*_at`, ghi thêm `inventory_movements`, `outbound_allocations`, `override_request_items` |
| `decide_change_request` ★ | Duyệt change request → sinh phiên bản mới |
| Trigger `stamp_actor`, `verify_blocked_exception`, `audit_config_change` | Giữ |
| Trigger `forbid_update_delete` ★ | Gắn vào 4 bảng bất biến (P4) |
