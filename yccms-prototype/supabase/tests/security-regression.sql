-- Security & rule regression tests for the SQL layer (RFP v2 fixtures). One transaction, ROLLED BACK.
-- Needs a fresh seed + demo users (`npm run db:seed`). Run: `npm run db:test`. Any failure raises → non-zero exit.
begin;
set local timezone to 'Asia/Tokyo';
select set_config('t.kho', (select id::text from profiles where email = 'kho@yuki-demo.jp'), true),
       set_config('t.ql',  (select id::text from profiles where email = 'quanly@yuki-demo.jp'), true);
create function pg_temp.order_id(p_suffix text) returns text language sql as $$
  select id::text from outbound_orders where code like 'OUT-%-' || p_suffix and status = 'open'
$$;
create function pg_temp.alloc(p_order text, p_sku text, p_lot text, p_qty int) returns jsonb language sql as $$
  select jsonb_build_object('order_line_id', l.id, 'lot_id', (select id from lots where lot_no = p_lot), 'qty', p_qty)
  from outbound_lines l join products p on p.id = l.product_id where l.order_id = p_order::uuid and p.sku = p_sku
$$;
do $$ begin
  if pg_temp.order_id('02') is null or pg_temp.order_id('03') is null or pg_temp.order_id('05') is null then
    raise exception 'Demo orders are no longer open — run `npm run db:seed` first';
  end if;
end $$;
select set_config('t.o1', pg_temp.order_id('01'), true), set_config('t.o2', pg_temp.order_id('02'), true),
       set_config('t.o3', pg_temp.order_id('03'), true), set_config('t.o5', pg_temp.order_id('05'), true);
select set_config('t.a2', jsonb_build_array(pg_temp.alloc(current_setting('t.o2'),'AMB-002','LOT-AMB002-A',30),
         pg_temp.alloc(current_setting('t.o2'),'CHI-003','LOT-CHI003-B',10), pg_temp.alloc(current_setting('t.o2'),'FRO-002','LOT-FRO002-A',24))::text, true),
       set_config('t.a2bad', jsonb_build_array(pg_temp.alloc(current_setting('t.o2'),'AMB-002','LOT-AMB002-A',30),
         pg_temp.alloc(current_setting('t.o2'),'CHI-003','LOT-CHI003-A',10), pg_temp.alloc(current_setting('t.o2'),'FRO-002','LOT-FRO002-A',24))::text, true),
       set_config('t.a1bad', jsonb_build_array(pg_temp.alloc(current_setting('t.o1'),'AMB-001','LOT-AMB001-B',10),
         pg_temp.alloc(current_setting('t.o1'),'CHI-001','LOT-CHI001-A',4), pg_temp.alloc(current_setting('t.o1'),'FRO-001','LOT-FRO001-X',20))::text, true),
       set_config('t.a3q', jsonb_build_array(pg_temp.alloc(current_setting('t.o3'),'CHI-002','LOT-CHI002-B',24),
         pg_temp.alloc(current_setting('t.o3'),'CHI-004','LOT-CHI004-A',10), pg_temp.alloc(current_setting('t.o3'),'FRO-003','LOT-FRO003-A',20))::text, true),
       set_config('t.a3', jsonb_build_array(pg_temp.alloc(current_setting('t.o3'),'CHI-002','LOT-CHI002-A',24),
         pg_temp.alloc(current_setting('t.o3'),'CHI-004','LOT-CHI004-B',10), pg_temp.alloc(current_setting('t.o3'),'FRO-003','LOT-FRO003-A',20))::text, true),
       set_config('t.a5', jsonb_build_array(pg_temp.alloc(current_setting('t.o5'),'CHI-002','LOT-CHI002-B',6),
         pg_temp.alloc(current_setting('t.o5'),'CHI-002','LOT-CHI002-A',6), pg_temp.alloc(current_setting('t.o5'),'AMB-004','LOT-AMB004-A',10),
         pg_temp.alloc(current_setting('t.o5'),'FRO-001','LOT-FRO001-A',10))::text, true);

-- W1: OUT-02 planned for yesterday (late shipment) → 消費期限 must be judged on TODAY
update outbound_orders set ship_date = current_date - 1 where id = current_setting('t.o2')::uuid;

create function pg_temp.act_as(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
-- expect: run p_sql and require an exception whose message starts with p_code ('PRIV' = insufficient_privilege)
create function pg_temp.expect(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if sqlerrm like p_code || '%' or (p_code = 'PRIV' and sqlstate = '42501') then raise notice 'PASS %', p_label; return; end if;
    raise exception 'FAIL %: expected %, got % (%)', p_label, p_code, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL %: expected %, statement succeeded', p_label, p_code;
end $$;
grant execute on function pg_temp.act_as(text), pg_temp.expect(text, text, text) to authenticated;
set local role authenticated;

-- ---------- access control ----------
select pg_temp.act_as(current_setting('t.kho'));
select pg_temp.expect($$update profiles set role = 'manager' where id = auth.uid()$$, 'PRIV', 'C1 warehouse cannot self-promote');
select pg_temp.expect($$delete from delivery_history$$, 'PRIV', 'H3 history immutable for app users');
select pg_temp.expect($$update lots set qty_on_hand = 999$$, 'PRIV', 'H3 stock not writable directly');
select pg_temp.expect($$insert into override_requests (order_id, allocations, ship_temp_c, reason, requested_by) values (gen_random_uuid(), '[]', 0, 'x', auth.uid())$$, 'PRIV', 'H3 override requests only via RPC');
do $$ declare n int; begin
  update temperature_zones set max_c = 99 where id = 2; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL warehouse edited thresholds'; end if;
  update customer_sku_agreements set window_rule = 'ONE_HALF' where code = 'AGR-008'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL warehouse set an undetermined window'; end if;
  raise notice 'PASS config edits are manager-only';
end $$;
do $$ declare v text; begin
  insert into audit_logs (actor_id, actor_email, action, entity) values (current_setting('t.ql')::uuid, 'quanly@yuki-demo.jp', 'forged', 'x') returning actor_email into v;
  if v <> 'kho@yuki-demo.jp' then raise exception 'FAIL W1 forged audit actor kept (%)', v; end if;
  raise notice 'PASS W1 audit actor stamped from JWT';
end $$;
select pg_temp.expect(format($$insert into allocation_exceptions (rule, order_id, customer_id, product_id, lot_id, lot_expiry, reference_date, decision, actor_id)
  values ('BR-EXP-02', %L, 0, 0, (select id from lots where lot_no = 'LOT-CHI003-B'), '1970-01-01', '1970-01-01', 'blocked', auth.uid())$$, current_setting('t.o2')),
  'NOT_A_VIOLATION', 'W1 fake 消費期限 exception rejected');

select pg_temp.act_as(gen_random_uuid()::text);
select pg_temp.expect(format($$select confirm_shipment(%L::uuid, %L::jsonb, -20)$$, current_setting('t.o2'), current_setting('t.a2')), 'NO_PROFILE', 'C2 unprovisioned caller cannot ship');

-- ---------- FR-OUT-02 chain in SQL ----------
select pg_temp.act_as(current_setting('t.kho'));
select pg_temp.expect(format($$select confirm_shipment(%L::uuid, %L::jsonb, 3.5)$$, current_setting('t.o2'), current_setting('t.a2')), 'SHIP_TEMP_OUT_OF_RANGE', 'W2 ship temp checked on coldest band');
select pg_temp.expect(format($$select confirm_shipment(%L::uuid, %L::jsonb, -20)$$, current_setting('t.o2'), current_setting('t.a2bad')), 'USE_BY_EXPIRED', '① 消費期限 hard stop (late shipment judged on today)');
select pg_temp.expect(format($$select confirm_shipment(%L::uuid, %L::jsonb, -20)$$, current_setting('t.o1'), current_setting('t.a1bad')), 'ZONE_MISMATCH', '② wrong band');
select pg_temp.expect(format($$select confirm_shipment(%L::uuid, %L::jsonb, -20)$$, current_setting('t.o3'), current_setting('t.a3q')), 'LOT_QUARANTINED', '③ 隔離 locked');
select pg_temp.expect(format($$select confirm_shipment(%L::uuid, %L::jsonb, -20)$$, current_setting('t.o3'), current_setting('t.a3')), 'DATE_REVERSAL', '⑤ 日付逆転 blocks (US-02 CUS-003/CHI-002)');
do $$ begin
  perform confirm_shipment(current_setting('t.o5')::uuid, current_setting('t.a5')::jsonb, -20);
  raise notice 'PASS CUS-005 does not borrow CUS-003 history; non-FEFO allocation order OK (H1)';
  perform confirm_shipment(current_setting('t.o2')::uuid, current_setting('t.a2')::jsonb, -20);
  raise notice 'PASS valid shipment confirmed';
  if not exists (select 1 from allocation_exceptions e join lots l on l.id = e.lot_id
     where e.rule = 'BR-EXP-02' and e.order_id = current_setting('t.o2')::uuid and l.lot_no = 'LOT-CHI003-A') then
    raise exception 'FAIL W3 excluded 消費期限 lot not recorded';
  end if;
  raise notice 'PASS W3 BR-EXP-02 event recorded for the lot allocation excluded';
end $$;

-- ---------- maker-checker ----------
select pg_temp.act_as(current_setting('t.ql'));
do $$ declare v uuid; begin
  begin
    v := request_override(current_setting('t.o3')::uuid, current_setting('t.a3')::jsonb, -20, 'self');
    perform decide_override(v, true, '');
    raise exception 'FAIL manager approved own request';
  exception when raise_exception then
    if sqlerrm not like 'SELF_APPROVAL%' then raise; end if;
    raise notice 'PASS requester cannot approve own request (NFR-SEC-02)';
  end;
end $$;
select pg_temp.act_as(current_setting('t.kho'));
select set_config('t.req', request_override(current_setting('t.o3')::uuid, current_setting('t.a3')::jsonb, -20, 'Khách đồng ý')::text, true);
select pg_temp.expect(format($$select decide_override(%L::uuid, true, '')$$, current_setting('t.req')), 'FORBIDDEN', 'warehouse cannot approve');
select pg_temp.act_as(current_setting('t.ql'));
do $$ declare n int; begin
  perform decide_override(current_setting('t.req')::uuid, true, 'OK');
  select count(*) into n from allocation_exceptions where decision = 'overridden' and order_id = current_setting('t.o3')::uuid
    and approver_email = 'quanly@yuki-demo.jp' and reason like 'Khách đồng ý%kho@yuki-demo.jp%';
  if n <> 1 then raise exception 'FAIL override not logged with requester + approver'; end if;
  if (select status from outbound_orders where id = current_setting('t.o3')::uuid) <> 'shipped' then raise exception 'FAIL not shipped'; end if;
  raise notice 'PASS approved exception ships and is logged';
end $$;

-- ---------- quarantine & inbound ----------
select pg_temp.act_as(current_setting('t.kho'));
select pg_temp.expect($$select resolve_quarantine((select id from lots where lot_no = 'LOT-CHI004-A'), 'release', (select id from locations where code = 'C-03-01'), 'ok')$$, 'FORBIDDEN', 'warehouse cannot release 隔離');
select pg_temp.expect($$select confirm_inbound_receipt(3, current_date, null, '[{"product_id":5,"lot_no":"T-B9","mfg_date":"2026-01-01","expiry_date":"2099-01-01","qty":1,"temp_c":3,"trace_code":"140812345","location_id":4,"result":"accepted"}]')$$, 'BEEF_ID_REVIEW', 'beef 9-digit id → business-review');
select pg_temp.expect($$select confirm_inbound_receipt(1, date '2020-01-01', null, '[{"product_id":7,"lot_no":"T-OLD","mfg_date":"2019-12-28","expiry_date":"2020-01-02","qty":1,"temp_c":3,"location_id":6,"result":"accepted"}]')$$, 'INVALID_ARRIVAL_DATE', 'M1 back-dated arrival rejected');
select pg_temp.expect($$select confirm_inbound_receipt(1, current_date, null, '[{"product_id":6,"lot_no":"T-Y9","mfg_date":"2026-01-01","expiry_date":"2099-01-01","qty":1,"temp_c":9,"temp_note":"x","location_id":5,"result":"accepted"}]')$$, 'TEMP_DEVIATION', 'deviation cannot be accepted');
select pg_temp.act_as(current_setting('t.ql'));
do $$ begin
  perform resolve_quarantine((select id from lots where lot_no = 'LOT-CHI004-A'), 'release', (select id from locations where code = 'C-03-01'), 'QA đo lại 3.8°C');
  if (select status from lots where lot_no = 'LOT-CHI004-A') <> 'available' then raise exception 'FAIL release'; end if;
  raise notice 'PASS manager releases 隔離 lot';
  update products set expiry_type = 'best_before' where sku = 'CHI-003';
  if not exists (select 1 from audit_logs where action = 'products.update' and actor_email = 'quanly@yuki-demo.jp'
     and detail->'before'->>'expiry_type' = 'use_by') then raise exception 'FAIL W4 config change not audited by DB'; end if;
  raise notice 'PASS W4 config change audited by DB trigger (before → after)';
end $$;

reset role;
set local role anon;
do $$ begin
  begin perform 1 from lots limit 1; if found then raise exception 'FAIL anon can read lots'; end if;
  exception when insufficient_privilege then null; end;
  raise notice 'PASS anon cannot read business data';
end $$;
rollback;
