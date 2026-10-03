# Đặc tả API (BFF — Next.js Route Handlers)

## 1. Quy ước chung

| Mục | Quy ước |
|---|---|
| Base | Cùng origin với trang (`/api/*`), JSON UTF-8 |
| Xác thực | Cookie phiên Supabase (`@supabase/ssr`). Mọi route bọc `withAuth`: không phiên → 401 `{"error":"Chưa đăng nhập"}`; không có `profiles` → 403 |
| Quyền DB | Route gọi Supabase bằng **JWT của người dùng**; RLS và hàm SQL quyết định quyền cuối cùng. Không dùng service role |
| Lỗi | `{ "error": string, "details"?: { "errors"?: string[], "reversals"?: BlockedLot[] } }` · mã HTTP theo `01-basic-design/02-architecture-and-data-flow.md` mục 2.8 |
| Id | `[id]` số nguyên dương hoặc UUID; sai định dạng → 404 |
| Ngày | `yyyy-mm-dd` (ngày nghiệp vụ JST); thời điểm ISO 8601 có múi giờ |
| Idempotency | Prototype: không (dựa vào khóa + trạng thái để chặn ghi trùng). Đích: header `Idempotency-Key` cho POST nhập kho và giao hàng |

## 2. Danh sách endpoint

| # | Method & path | Vai trò | Màn | Mô tả |
|---|---|---|---|---|
| A01 | `GET /api/me` | mọi | khung chung | Hồ sơ người đăng nhập |
| A02 | `GET /api/dashboard` | mọi | SCR-01 | KPI |
| A03 | `GET /api/master` | mọi | SCR-07, SCR-10 | NCC, SKU, vị trí, dải nhiệt |
| A04 | `GET /api/inbound` | mọi | SCR-07 | Danh sách phiếu |
| A05 | `POST /api/inbound` | warehouse, manager | SCR-07 | Tạo & kiểm phiếu (RPC) |
| A06 | `GET /api/inbound/[id]` | mọi | SCR-07 | Chi tiết phiếu |
| A07 | `GET /api/inventory` | mọi | SCR-08/10 | Tồn kho |
| A08 | `POST /api/lots/[id]/quarantine` | manager | SCR-10 | Release / scrap (RPC) |
| A09 | `GET /api/outbound` | mọi | SCR-12 | Đơn + tóm tắt kiểm trước |
| A10 | `GET /api/outbound/[id]` | mọi | SCR-13 | Kế hoạch lấy hàng |
| A11 | `POST /api/outbound/[id]/ship` | warehouse, manager | SCR-15 | Giao / chặn / đề nghị ngoại lệ (RPC) |
| A12 | `POST /api/override-requests/[id]/decision` | manager ≠ người lập | SCR-05 | Duyệt / từ chối (RPC) |
| A13 | `GET /api/alerts/date-reversal` | mọi | SCR-05 | Rủi ro, hàng chờ, nhật ký |
| A14 | `GET /api/customers` | mọi | SCR-03, SCR-27 | Khách + hợp đồng + tóm tắt giao |
| A15 | `GET /api/customers/[id]` | mọi | DR-HIST-01 | Lịch sử giao |
| A16 | `PATCH /api/agreements/[id]` | manager | SCR-03 | Chốt delivery window |
| A17 | `GET /api/settings` | mọi | SCR-32/02 | Dải nhiệt + SKU |
| A18 | `PATCH /api/settings/zones/[id]` | manager | SCR-32 | Sửa ngưỡng |
| A19 | `PATCH /api/settings/products/[id]` | manager | SCR-02 | Sửa loại hạn, ngưỡng cận hạn |
| A20 | `GET /api/trace` | mọi | SCR-27 | Truy xuôi / ngược |
| A21 | `GET /api/audit` | mọi (đích: hạn chế) | SCR-34 | Audit log |

## 3. Chi tiết các endpoint ghi

### A05 `POST /api/inbound`

Request:
```json
{
  "supplier_id": 1,
  "arrival_date": "2026-10-03",
  "note": "string | null",
  "lines": [{
    "product_id": 6, "lot_no": "LOT-CHI002-Z", "mfg_date": "2026-09-28", "expiry_date": "2026-10-12",
    "qty": 40, "temp_c": 3.5, "temp_note": "", "trace_code": "", "location_id": 4,
    "result": "accepted | rejected | hold"
  }]
}
```

| HTTP | Body | Khi nào |
|---|---|---|
| 200 | `{"id": "<uuid phiếu>"}` | Ghi thành công |
| 409 | `{"error":"Số lô đã tồn tại cho sản phẩm này — kiểm tra lại số lô."}` | Trùng (SKU, số lô) |
| 422 | `{"error":"Phiếu nhập chưa hợp lệ","details":["Dòng 1 (CHI-002): …", …]}` | Lỗi kiểm BFF (gom nhiều lỗi) |
| 422 | `{"error":"<thông báo theo mã SQL> (SKU)"}` | Lỗi chốt SQL có mã (V1–V4, V7, V9–V13, V15 của SCR-07) |
| 500 | `{"error":"Lưu phiếu nhập thất bại. Vui lòng thử lại."}` | Vi phạm CHECK của bảng (V6, V8) khi lách BFF; bản đích ánh xạ `23514` → 422 |

Lưu ý: ở 422 của BFF, `details` là **mảng chuỗi** (không bọc trong `errors`).

### A08 `POST /api/lots/[id]/quarantine`

Request: `{"action":"release|scrap","location_id": 6 | null,"reason":"string"}` → 200 `{"ok":true}` · 403 `FORBIDDEN` · 409 `LOT_NOT_QUARANTINED` · 422 `REASON_REQUIRED` / `INVALID_LOCATION` / `INVALID_ACTION`.

### A11 `POST /api/outbound/[id]/ship`

Request:
```json
{
  "allocations": [{ "order_line_id": "<uuid>", "lot_id": "<uuid>", "qty": 24 }],
  "ship_temp_c": -20,
  "override_reason": "string (chỉ khi chọn lô 日付逆転)"
}
```

| HTTP | Body | Khi nào |
|---|---|---|
| 200 | `{"ok":true,"requested":false,"warnings":["…"]}` | Giao thành công |
| 200 | `{"ok":true,"requested":true,"requestId":"<uuid>","warnings":[…]}` | Đã tạo đề nghị ngoại lệ |
| 404 | `{"error":"Không tìm thấy đơn xuất"}` | |
| 409 | `{"error":"CHẶN: vi phạm 日付逆転禁止. …","details":{"reversals":[{"lot_id","lot_no","sku"}]}}` | Có lô ⑤, không lý do (đã ghi lượt chặn) |
| 409 | `{"error":"Đơn này đã có đề nghị ngoại lệ đang chờ duyệt."}` | Trùng đề nghị pending |
| 409 | `INSUFFICIENT_STOCK`, `ORDER_NOT_OPEN`, `DATE_REVERSAL` (từ SQL) | Dữ liệu đổi giữa lúc xem và lúc giao |
| 422 | `{"error":"Chưa thể xác nhận giao","details":{"errors":["…"]}}` | Lỗi kiểm BFF (V1–V12 SCR-15) |
| 422 | Mã SQL: `USE_BY_EXPIRED`, `ZONE_MISMATCH`, `LOT_QUARANTINED`, `SHIP_TEMP_OUT_OF_RANGE`, `ALLOCATION_MISMATCH`, `NO_REVERSAL`, `REASON_REQUIRED`… | Chốt cuối |

### A12 `POST /api/override-requests/[id]/decision`

Request: `{"approve": true|false, "note": "string"}` (chỉ `approve === true` mới tính là duyệt) → 200 `{"ok":true}` · 403 `FORBIDDEN` / `SELF_APPROVAL` · 409 `REQUEST_NOT_PENDING` · 422 `REASON_REQUIRED` · lỗi của `_validate_shipment` khi duyệt.

### A16 `PATCH /api/agreements/[id]`

Request: `{"window_rule":"ONE_THIRD|ONE_HALF|LABEL_DATE_ONLY"}` → 200 · 403 · 404 · 422.

### A18 `PATCH /api/settings/zones/[id]`

Request: `{"min_c": number|""|null, "max_c": number|""|null}` → 200 · 403 · 404 · 422 (không phải số / cả hai trống / min > max).

### A19 `PATCH /api/settings/products/[id]`

Request: `{"expiry_type":"best_before|use_by","near_expiry_days": 0..365}` → 200 · 403 · 404 · 422.

## 4. Chi tiết các endpoint đọc (dạng response)

| # | Tham số | Response (rút gọn) |
|---|---|---|
| A01 | — | `{email, full_name, role}` (prototype trả đúng 3 trường này, không có `id`) |
| A02 | — | `{today, inboundToday, openOrders, reversalBlocked, pendingApprovals, excludedLots, quarantineLots, nearExpiryLots, useByExpiredLots, reviewAgreements, tempFailures7d, blockedEvents7d, overrides7d, recentAudit[]}` |
| A03 | — | `{suppliers[{id,code,name}], products[{id,sku,name,unit,zone_id,expiry_type,trace_lane}], locations[{id,code,zone_id,is_quarantine}], zones[{id,code,name,min_c,max_c}]}` |
| A04 | — | `{receipts[{id,code,arrival_date,note,created_at,supplier{code,name},lines[{qty,temp_ok,result}]}]}` |
| A06 | — | `{receipt{…, supplier, lines[{…, location{code}, product{sku,name,unit,expiry_type,trace_lane,zone{name,min_c,max_c}}}]}}` |
| A07 | `view=all\|near\|quarantine`, `zone=0..3` | `{today, lots[{id,lot_no,mfg_date,expiry_date,qty_received,qty_on_hand,status,trace_code,received_at,daysLeft,expiry:'ok'\|'near'\|'expired',location,supplier,product}]}` |
| A09 | — | `{orders[{id,code,ship_date,status,ship_temp_c,shipped_at,customer,lineCount,totalQty,reversalLines,shortLines,reviewLines,excludedLots,pendingOverride}]}` |
| A10 | — | `{plan: PickPlan, delivered[]}`. `PickPlan = {order, customer, lines[PlanLine], shipTempRange{min,max}, pendingOverride{id,reason,requested_email,created_at,ship_temp_c,items[]}\|null}`; `PlanLine = {id, qty, product, agreement\|null, lastDelivery\|null, lots[{…, exclusions[], window{status,rule,deadline}}], suggestion{allocations[],shortfall,excluded[]}, status, reversalOnlyQty}` |
| A13 | — | `{risks[{order,customer,product,qty,severity:'blocked'\|'avoided',shortfall,pending,lastDelivery,reversalLots[]}], requests[≤50], events[≤100]}` |
| A14 | — | `{customers[{id,code,name,deliveries,lastDeliveredAt,agreements[{id,code,delivery_term,window_rule,effective_from,product}]}]}` |
| A15 | `sku`, `from`, `to` | `{customer{id,code,name}, history[{id,qty,expiry_date,delivered_at,order,lot,product}]}` |
| A17 | — | `{zones[], products[]}` |
| A20 | `lot` **hoặc** `customer` | `{mode:'forward', lot, deliveries[]}` · `{mode:'backward', deliveries[]}` |
| A21 | `action` (tiền tố) | `{logs[≤200]}` |

## 5. Hàm SQL (RPC) được gọi

| Hàm | Execute cấp cho | Gọi từ | Ghi bảng |
|---|---|---|---|
| `confirm_inbound_receipt(int, date, text, jsonb) → uuid` | `authenticated` | A05 | `inbound_receipts`, `inbound_lines`, `lots`, `audit_logs` |
| `resolve_quarantine(uuid, text, int, text)` | `authenticated` | A08 | `lots`, `audit_logs` |
| `confirm_shipment(uuid, jsonb, numeric)` | `authenticated` | A11 | qua `_perform_shipment` |
| `request_override(uuid, jsonb, numeric, text) → uuid` | `authenticated` | A11 | `override_requests`, `audit_logs` |
| `decide_override(uuid, boolean, text)` | `authenticated` | A12 | `override_requests` (+ `_perform_shipment` khi duyệt), `audit_logs` |
| `_validate_shipment(...)`, `_perform_shipment(...)` | **không ai** (nội bộ) | các hàm trên | `lots`, `delivery_history`, `outbound_orders`, `allocation_exceptions`, `override_requests`, `audit_logs` |
| `last_deliveries(int[], int[])` | `authenticated` (SECURITY INVOKER) | pick-plan | — |
| `customer_delivery_summary()` | `authenticated` (SECURITY INVOKER) | A14 | — |
