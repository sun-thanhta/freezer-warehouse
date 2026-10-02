-- YCCMS prototype — schema (tables, indexes). Aligned with RFP YCL-RFP-2026-01 v2.0.
-- Apply on a fresh Supabase project: `npm run db:setup` or paste into SQL Editor.
create extension if not exists pgcrypto;

-- ---------- Master data ----------
-- 3 temperature bands with Yuki's SELF-DECLARED thresholds (R-01, BR-TEMP-01)
create table if not exists temperature_zones (
  id          smallint primary key,
  code        text not null unique check (code in ('ambient','chilled','frozen')),
  name        text not null,
  min_c       numeric(5,1),          -- null = no lower bound
  max_c       numeric(5,1),          -- null = no upper bound
  updated_at  timestamptz not null default now()
);

-- Locations (R-01). -Q locations = physical quarantine (隔離) split by band (C-Q, F-Q; ambient has none)
create table if not exists locations (
  id             serial primary key,
  code           text not null unique,
  zone_id        smallint not null references temperature_zones(id),
  is_quarantine  boolean not null default false
);

create table if not exists suppliers (
  id    serial primary key,
  code  text not null unique,
  name  text not null
);

create table if not exists customers (
  id    serial primary key,
  code  text not null unique,
  name  text not null
);

-- 12 SKU master (R-02): expiry type per SKU (BR-EXP-01), traceability lane (BR-TRACE)
create table if not exists products (
  id                 serial primary key,
  sku                text not null unique,
  name               text not null,
  unit               text not null,
  zone_id            smallint not null references temperature_zones(id),
  expiry_type        text not null check (expiry_type in ('best_before','use_by')), -- 賞味期限 / 消費期限
  trace_lane         text not null check (trace_lane in ('rice','beef','internal_lot')),
  near_expiry_days   int not null default 7,
  updated_at         timestamptz not null default now()
);

-- Customer × SKU agreements (R-04). window_rule NULL = not yet agreed → business-review, never defaulted
create table if not exists customer_sku_agreements (
  id              serial primary key,
  code            text not null unique,
  customer_id     int not null references customers(id),
  product_id      int not null references products(id),
  delivery_term   text not null check (delivery_term in ('軒先渡し','車上渡し')),
  window_rule     text check (window_rule in ('ONE_THIRD','ONE_HALF','LABEL_DATE_ONLY')),
  effective_from  date not null,
  updated_at      timestamptz not null default now(),
  unique (customer_id, product_id)
);

-- ---------- Inbound ----------
create table if not exists inbound_receipts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  supplier_id   int not null references suppliers(id),
  arrival_date  date not null default current_date,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

create table if not exists inbound_lines (
  id           uuid primary key default gen_random_uuid(),
  receipt_id   uuid not null references inbound_receipts(id) on delete cascade,
  product_id   int not null references products(id),
  lot_no       text not null,
  mfg_date     date not null,
  expiry_date  date not null,
  qty          int not null check (qty > 0),
  temp_c       numeric(5,1) not null,
  temp_ok      boolean not null,
  temp_note    text,
  trace_code   text,
  location_id  int references locations(id),
  result       text not null check (result in ('accepted','rejected','hold')), -- 受入 / 拒否 / 保留 (→ 隔離)
  check (expiry_date >= mfg_date)
);

create table if not exists lots (
  id              uuid primary key default gen_random_uuid(),
  product_id      int not null references products(id),
  supplier_id     int not null references suppliers(id),
  inbound_line_id uuid references inbound_lines(id),
  lot_no          text not null,
  mfg_date        date not null,
  expiry_date     date not null,
  qty_received    int not null check (qty_received > 0),
  qty_on_hand     int not null check (qty_on_hand >= 0),
  location_id     int references locations(id),
  status          text not null default 'available' check (status in ('available','quarantine','scrapped')),
  trace_code      text,
  received_at     timestamptz not null default now(),
  unique (product_id, lot_no)
);
create index if not exists lots_product_expiry_idx on lots (product_id, expiry_date, received_at);

-- ---------- Outbound ----------
create table if not exists outbound_orders (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  customer_id  int not null references customers(id),
  ship_date    date not null,
  status       text not null default 'open' check (status in ('open','shipped')),
  ship_temp_c  numeric(5,1),
  shipped_at   timestamptz,
  shipped_by   uuid,
  created_at   timestamptz not null default now()
);

create table if not exists outbound_lines (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references outbound_orders(id) on delete cascade,
  product_id  int not null references products(id),
  qty         int not null check (qty > 0)
);

-- Delivery history (DR-HIST-01, immutable) = basis of 日付逆転禁止 per customer × SKU pair (BR-DATE-01)
create table if not exists delivery_history (
  id            uuid primary key default gen_random_uuid(),
  customer_id   int not null references customers(id),
  product_id    int not null references products(id),
  lot_id        uuid not null references lots(id),
  order_id      uuid references outbound_orders(id),
  qty           int not null check (qty > 0),
  expiry_date   date not null,
  delivered_at  timestamptz not null default now()
);
create index if not exists delivery_history_cust_prod_idx on delivery_history (customer_id, product_id, expiry_date desc);
create index if not exists delivery_history_lot_idx on delivery_history (lot_id);

-- Immutable exception log: blocked 日付逆転 (BR-DATE-01) / 消費期限 (BR-EXP-02) attempts + approved overrides
create table if not exists allocation_exceptions (
  id              uuid primary key default gen_random_uuid(),
  rule            text not null check (rule in ('BR-DATE-01','BR-EXP-02')),
  order_id        uuid not null references outbound_orders(id),
  customer_id     int not null references customers(id),
  product_id      int not null references products(id),
  lot_id          uuid not null references lots(id),
  lot_expiry      date not null,
  reference_date  date not null,   -- BR-DATE-01: last delivered expiry · BR-EXP-02: ship date
  decision        text not null check (decision in ('blocked','overridden')),
  reason          text,
  actor_id        uuid,
  actor_email     text,
  approver_email  text,
  created_at      timestamptz not null default now()
);

-- Maker-checker (NFR-SEC-02) for 日付逆転 exceptions: the requester can never approve their own request
create table if not exists override_requests (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references outbound_orders(id),
  allocations     jsonb not null,
  ship_temp_c     numeric(5,1) not null,
  reason          text not null,
  status          text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_by    uuid not null,
  requested_email text,
  decided_by      uuid,
  decided_email   text,
  decision_note   text,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);
create unique index if not exists override_requests_one_pending on override_requests (order_id) where status = 'pending';

-- ---------- Users & audit ----------
create table if not exists profiles (
  id         uuid primary key,            -- = auth.users.id
  email      text not null,
  full_name  text not null,
  role       text not null check (role in ('warehouse','manager'))
);

create table if not exists audit_logs (
  id           bigserial primary key,
  actor_id     uuid,
  actor_email  text,
  action       text not null,
  entity       text not null,
  entity_id    text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs (created_at desc);

-- Inbound receipt numbers (global sequence → no race)
create sequence if not exists inbound_receipt_seq;
