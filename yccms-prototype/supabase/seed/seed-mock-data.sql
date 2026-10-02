begin;
set local timezone to 'Asia/Tokyo'; -- current_date = business day in Japan
-- YCCMS prototype — MOCK data built from the RFP fixtures (R-01 layout, R-02 12 SKU, R-04 15 agreements).
-- Lots, history and orders are fictional; dates are relative to today so every scenario stays valid.
-- Re-runnable: wipes business tables first (keeps profiles / auth users).

truncate override_requests, allocation_exceptions, delivery_history, outbound_lines, outbound_orders, lots,
  inbound_lines, inbound_receipts, customer_sku_agreements, products, customers, suppliers, locations,
  temperature_zones, audit_logs restart identity cascade;

-- 3 bands — thresholds SELF-DECLARED by Yuki (R-01), editable on the settings screen
insert into temperature_zones (id, code, name, min_c, max_c) values
  (1, 'ambient', '常温 (Thường)', 15, 25), (2, 'chilled', '冷蔵 (Mát)', 0, 5), (3, 'frozen', '冷凍 (Đông)', null, -18);

insert into locations (code, zone_id, is_quarantine) values
  ('A-01-01',1,false),('A-02-01',1,false),('A-03-01',1,false),
  ('C-01-01',2,false),('C-02-01',2,false),('C-03-01',2,false),('C-Q-01',2,true),
  ('F-01-01',3,false),('F-02-01',3,false),('F-03-01',3,false),('F-04-01',3,false),('F-Q-01',3,true);

insert into suppliers (code, name) values
  ('SUP-01','北海道ミルクファーム'), ('SUP-02','新潟ライス農協'), ('SUP-03','鹿児島和牛ファーム'),
  ('SUP-04','東京デリカ食品'), ('SUP-05','十勝フローズン');

insert into customers (code, name) values
  ('CUS-001','さくらマート 本店'), ('CUS-002','ひまわりストア 駅前店'), ('CUS-003','あおばスーパー 中央店'),
  ('CUS-004','みどり生協 北店'), ('CUS-005','こはるマーケット');

-- R-02: 12 SKU, 4 per band; only rice (AMB-001) and beef (CHI-001) carry statutory trace ids
insert into products (sku, name, unit, zone_id, expiry_type, trace_lane, near_expiry_days) values
  ('AMB-001','新潟県産包装精米5kg','bag',1,'best_before','rice',30),
  ('AMB-002','玄米せんべい12枚','pack',1,'best_before','internal_lot',30),
  ('AMB-003','レトルト野菜カレー200g','pouch',1,'best_before','internal_lot',30),
  ('AMB-004','ほうじ茶ティーバッグ20包','box',1,'best_before','internal_lot',30),
  ('CHI-001','国産牛スライス200g','tray',2,'use_by','beef',3),
  ('CHI-002','プレーンヨーグルト400g','cup',2,'best_before','internal_lot',5),
  ('CHI-003','絹ごし豆腐300g','pack',2,'use_by','internal_lot',2),
  ('CHI-004','カットサラダ150g','bag',2,'use_by','internal_lot',2),
  ('FRO-001','冷凍えび餃子12個','bag',3,'best_before','internal_lot',30),
  ('FRO-002','バニラアイス120ml','cup',3,'best_before','internal_lot',30),
  ('FRO-003','冷凍うどん5食','bag',3,'best_before','internal_lot',30),
  ('FRO-004','冷凍枝豆400g','bag',3,'best_before','internal_lot',30);

-- R-04: 15 customer × SKU agreements, effective 2026-04-01. AGR-008 / AGR-014 NOT yet agreed (NULL, never defaulted)
insert into customer_sku_agreements (code, customer_id, product_id, delivery_term, window_rule, effective_from)
select a.code, c.id, p.id, a.term, a.rule, date '2026-04-01' from (values
  ('AGR-001','CUS-001','AMB-001','軒先渡し','ONE_THIRD'), ('AGR-002','CUS-001','CHI-001','軒先渡し','ONE_HALF'),
  ('AGR-003','CUS-001','FRO-001','軒先渡し','LABEL_DATE_ONLY'), ('AGR-004','CUS-002','AMB-002','車上渡し','ONE_THIRD'),
  ('AGR-005','CUS-002','CHI-003','車上渡し','ONE_HALF'), ('AGR-006','CUS-002','FRO-002','車上渡し','LABEL_DATE_ONLY'),
  ('AGR-007','CUS-003','CHI-002','軒先渡し','ONE_HALF'), ('AGR-008','CUS-003','CHI-004','軒先渡し',null),
  ('AGR-009','CUS-003','FRO-003','軒先渡し','LABEL_DATE_ONLY'), ('AGR-010','CUS-004','AMB-003','車上渡し','ONE_THIRD'),
  ('AGR-011','CUS-004','CHI-001','車上渡し','ONE_HALF'), ('AGR-012','CUS-004','FRO-004','車上渡し','LABEL_DATE_ONLY'),
  ('AGR-013','CUS-005','AMB-004','軒先渡し','ONE_THIRD'), ('AGR-014','CUS-005','CHI-002','軒先渡し',null),
  ('AGR-015','CUS-005','FRO-001','軒先渡し','LABEL_DATE_ONLY')
) as a(code, cus, sku, term, rule) join customers c on c.code = a.cus join products p on p.sku = a.sku;

-- ---------- Inbound history → lots ----------
create temporary table _r (n int, sup text, day int) on commit drop;
insert into _r values (1,'SUP-02',-60),(2,'SUP-02',-10),(3,'SUP-04',-20),(4,'SUP-03',-2),(5,'SUP-01',-6),
  (6,'SUP-01',-3),(7,'SUP-01',-1),(8,'SUP-04',-5),(9,'SUP-05',-15),(10,'SUP-04',-1);
insert into inbound_receipts (code, supplier_id, arrival_date, note)
select 'IN-'||to_char(current_date+day,'YYMMDD')||'-S'||lpad(n::text,3,'0'), (select id from suppliers where code=sup), current_date+day, 'Dữ liệu mẫu (mock)'
from _r;

create temporary table _l (n int, sku text, lot text, mfg int, exp int, qty int, temp numeric, note text, trace text, loc text, res text) on commit drop;
insert into _l values
  (1,'AMB-001','LOT-AMB001-A',-200,165, 40,20.0,null,'新潟県魚沼産/取引No.2603-001','A-01-01','accepted'), -- ④ past 1/3 window
  (2,'AMB-001','LOT-AMB001-B', -15,350, 60,19.5,null,'新潟県魚沼産/取引No.2609-014','A-01-01','accepted'),
  (3,'AMB-002','LOT-AMB002-A', -30,150, 40,21.0,null,null,'A-02-01','accepted'),
  (3,'AMB-003','LOT-AMB003-A', -60,300, 60,21.0,null,null,'A-02-01','accepted'),
  (3,'AMB-004','LOT-AMB004-A', -40,500, 50,20.5,null,null,'A-03-01','accepted'),
  (4,'CHI-001','LOT-CHI001-A',  -2,  6, 20, 3.1,null,'1408123456','C-01-01','accepted'),
  (5,'CHI-002','LOT-CHI002-A',  -6, 10, 48, 4.2,null,null,'C-02-01','accepted'),
  (6,'CHI-002','LOT-CHI002-B',  -3, 14, 24, 3.9,null,null,'C-02-01','accepted'),
  (7,'CHI-002','LOT-CHI002-C',  -1, 20, 24, 3.6,null,null,'C-02-01','accepted'),
  (8,'AMB-002','LOT-AMB002-B', -30,150, 40,21.5,null,null,'A-02-01','accepted'), -- same expiry as -A, received later (FIFO tie-break)
  (8,'CHI-003','LOT-CHI003-A',  -5,  0, 10, 3.5,null,null,'C-03-01','accepted'), -- ① 消費期限 reached today
  (9,'FRO-001','LOT-FRO001-A', -90,270,100,-20.1,null,null,'F-01-01','accepted'),
  (9,'FRO-002','LOT-FRO002-A', -30,330, 80,-19.6,null,null,'F-02-01','accepted'),
  (9,'FRO-003','LOT-FRO003-A', -45,300, 60,-21.0,null,null,'F-03-01','accepted'),
  (9,'FRO-004','LOT-FRO004-A', -60,400, 50,-19.0,null,null,'F-04-01','accepted'),
  (10,'CHI-003','LOT-CHI003-B', -1,  4, 30, 3.8,null,null,'C-03-01','accepted'),
  (10,'CHI-004','LOT-CHI004-A', -2,  2, 10, 7.5,'Vượt 0–5°C khi nhận → 保留, chuyển 隔離 chờ QA','','C-Q-01','hold'), -- ③
  (10,'CHI-004','LOT-CHI004-B', -1,  3, 30, 4.0,null,null,'C-03-01','accepted'),
  (10,'CHI-003','LOT-CHI003-R', -1,  4, 12, 9.0,'Xe lạnh NCC hỏng — trả lại',null,null,'rejected');

insert into inbound_lines (receipt_id, product_id, lot_no, mfg_date, expiry_date, qty, temp_c, temp_ok, temp_note, trace_code, location_id, result)
select ir.id, p.id, l.lot, current_date+l.mfg, current_date+l.exp, l.qty, l.temp,
  (z.min_c is null or l.temp >= z.min_c) and (z.max_c is null or l.temp <= z.max_c), l.note, nullif(l.trace,''),
  (select id from locations where code=l.loc), l.res
from _l l join _r r on r.n=l.n
join inbound_receipts ir on ir.code='IN-'||to_char(current_date+r.day,'YYMMDD')||'-S'||lpad(r.n::text,3,'0')
join products p on p.sku=l.sku join temperature_zones z on z.id=p.zone_id;

insert into lots (product_id, supplier_id, inbound_line_id, lot_no, mfg_date, expiry_date, qty_received, qty_on_hand, location_id, status, trace_code, received_at)
select il.product_id, ir.supplier_id, il.id, il.lot_no, il.mfg_date, il.expiry_date, il.qty, il.qty, il.location_id,
  case when il.result = 'hold' then 'quarantine' else 'available' end, il.trace_code, ir.arrival_date + interval '8 hours'
from inbound_lines il join inbound_receipts ir on ir.id=il.receipt_id where il.result <> 'rejected';

-- ② Migrated lot stored in the WRONG band (frozen SKU in a chilled location) — no inbound record
insert into lots (product_id, supplier_id, lot_no, mfg_date, expiry_date, qty_received, qty_on_hand, location_id, trace_code, received_at)
select p.id, s.id, 'LOT-FRO001-X', current_date-120, current_date+240, 30, 30, (select id from locations where code='C-02-01'), null, current_date-40
from products p, suppliers s where p.sku='FRO-001' and s.code='SUP-05';

-- ---------- Delivery history (DR-HIST-01) + shipped orders ----------
create temporary table _h (n int, cust text, lot text, qty int, day int) on commit drop;
insert into _h values
  (1,'CUS-001','LOT-AMB001-A',10,-30),(2,'CUS-001','LOT-FRO001-A',20,-10),(3,'CUS-002','LOT-FRO002-A',10,-8),
  (4,'CUS-002','LOT-AMB002-A', 8,-7),(5,'CUS-003','LOT-CHI002-C',24,-1),(6,'CUS-004','LOT-CHI001-A', 5,-1);
insert into outbound_orders (code, customer_id, ship_date, status, ship_temp_c, shipped_at)
select 'OUT-'||to_char(current_date+h.day,'YYMMDD')||'-9'||h.n, c.id, current_date+h.day, 'shipped', -20.0,
  (current_date+h.day)::timestamptz + interval '6 hours'
from _h h join customers c on c.code=h.cust;
insert into outbound_lines (order_id, product_id, qty)
select o.id, lo.product_id, h.qty from _h h join lots lo on lo.lot_no=h.lot
join outbound_orders o on o.code='OUT-'||to_char(current_date+h.day,'YYMMDD')||'-9'||h.n;
insert into delivery_history (customer_id, product_id, lot_id, order_id, qty, expiry_date, delivered_at)
select o.customer_id, lo.product_id, lo.id, o.id, h.qty, lo.expiry_date, o.shipped_at from _h h
join lots lo on lo.lot_no=h.lot join outbound_orders o on o.code='OUT-'||to_char(current_date+h.day,'YYMMDD')||'-9'||h.n;
update lots set qty_on_hand = qty_received - coalesce((select sum(qty) from delivery_history d where d.lot_id=lots.id),0);

-- ---------- Open orders (demo scenarios) ----------
create temporary table _o (n int, cust text, day int) on commit drop;
insert into _o values (1,'CUS-001',0),(2,'CUS-002',0),(3,'CUS-003',0),(4,'CUS-004',1),(5,'CUS-005',1);
insert into outbound_orders (code, customer_id, ship_date)
select 'OUT-'||to_char(current_date+o.day,'YYMMDD')||'-0'||o.n, c.id, current_date+o.day from _o o join customers c on c.code=o.cust;
create temporary table _ol (n int, sku text, qty int) on commit drop;
insert into _ol values
  (1,'AMB-001',10),(1,'CHI-001',4),(1,'FRO-001',20),  -- ④ old rice lot past 1/3 · ② FRO-001-X in wrong band
  (2,'AMB-002',30),(2,'CHI-003',10),(2,'FRO-002',24),  -- FEFO tie → FIFO · ① tofu 消費期限 reached
  (3,'CHI-002',24),(3,'CHI-004',10),(3,'FRO-003',20),  -- ⑤ 日付逆転 BLOCK (US-02: CUS-003/CHI-002) · ③ 隔離 · AGR-008 review
  (4,'AMB-003',12),(4,'CHI-001',5),(4,'FRO-004',15),
  (5,'AMB-004',10),(5,'CHI-002',12),(5,'FRO-001',10);  -- CUS-005 has no CHI-002 history (never borrows CUS-003's) · AGR-014 review
insert into outbound_lines (order_id, product_id, qty)
select oo.id, p.id, ol.qty from _ol ol join _o o on o.n=ol.n
join outbound_orders oo on oo.code='OUT-'||to_char(current_date+o.day,'YYMMDD')||'-0'||o.n join products p on p.sku=ol.sku;

insert into audit_logs (actor_email, action, entity, detail)
values ('system', 'seed.load', 'database', jsonb_build_object('note', 'Nạp bộ dữ liệu mock theo fixture RFP', 'seeded_on', current_date));
commit;
