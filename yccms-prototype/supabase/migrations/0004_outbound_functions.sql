-- YCCMS prototype — outbound: authoritative allocation checks in the FR-OUT-02 exclusion order,
-- shipment, and the maker-checker flow for 日付逆転 exceptions (NFR-SEC-02).
--   ① 消費期限 reached/passed (BR-EXP-02, hard stop, no override) ② band mismatch (BR-TEMP-02)
--   ③ quarantine (FR-INV-05) ④ delivery window (BR-DELWIN-01: custom → warning only, checked in the app)
--   ⑤ 日付逆転 (BR-DATE-01: vs the latest expiry delivered to the SAME customer × SKU, never vs today)

-- Validates allocations; returns the 日付逆転 items (jsonb array). Raises on any hard violation.
create or replace function _validate_shipment(p_order outbound_orders, p_allocations jsonb, p_ship_temp numeric, p_lock boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_line outbound_lines%rowtype; v_alloc jsonb; v_lot lots%rowtype; v_prod products%rowtype; v_loc_zone smallint;
  v_qty int; v_tmin numeric; v_tmax numeric; v_last date; v_last_map jsonb; v_rev jsonb := '[]'::jsonb; v_sum record;
  v_ref date := greatest(p_order.ship_date, (now() at time zone 'Asia/Tokyo')::date); -- a late shipment uses today
begin
  -- Ship temperature: coldest band of the order
  with z as (select tz.min_c, tz.max_c, coalesce(tz.max_c, 1e9) as zmax from outbound_lines l
             join products pr on pr.id = l.product_id join temperature_zones tz on tz.id = pr.zone_id where l.order_id = p_order.id)
  select max(min_c), min(max_c) into v_tmin, v_tmax from z where zmax = (select min(zmax) from z);
  if p_ship_temp is null or p_ship_temp < v_tmin or p_ship_temp > v_tmax then raise exception 'SHIP_TEMP_OUT_OF_RANGE'; end if;

  for v_line in select * from outbound_lines where order_id = p_order.id loop
    select coalesce(sum((a->>'qty')::int), 0) into v_qty from jsonb_array_elements(p_allocations) a
      where (a->>'order_line_id')::uuid = v_line.id;
    if v_qty <> v_line.qty then raise exception 'ALLOCATION_MISMATCH:%', v_line.id; end if;
  end loop;

  -- History snapshot BEFORE this shipment: {product_id: latest expiry delivered to this customer}
  select coalesce(jsonb_object_agg(product_id, last_expiry), '{}'::jsonb) into v_last_map from (
    select product_id, max(expiry_date) as last_expiry from delivery_history
    where customer_id = p_order.customer_id
      and product_id in (select product_id from outbound_lines where order_id = p_order.id)
    group by product_id) h;

  for v_alloc in select a from jsonb_array_elements(p_allocations) a order by a->>'lot_id' loop
    if (v_alloc->>'qty')::int <= 0 then raise exception 'INVALID_QTY'; end if;
    select * into v_line from outbound_lines where id = (v_alloc->>'order_line_id')::uuid and order_id = p_order.id;
    if not found then raise exception 'LINE_NOT_IN_ORDER'; end if;
    if p_lock then select * into v_lot from lots where id = (v_alloc->>'lot_id')::uuid for update;
    else select * into v_lot from lots where id = (v_alloc->>'lot_id')::uuid; end if;
    if v_lot.id is null or v_lot.product_id <> v_line.product_id then raise exception 'LOT_PRODUCT_MISMATCH'; end if;
    if v_lot.qty_on_hand < (v_alloc->>'qty')::int then raise exception 'INSUFFICIENT_STOCK:%', v_lot.lot_no; end if;
    select * into v_prod from products where id = v_lot.product_id;
    select zone_id into v_loc_zone from locations where id = v_lot.location_id;
    if v_prod.expiry_type = 'use_by' and v_lot.expiry_date <= v_ref then raise exception 'USE_BY_EXPIRED:%', v_lot.lot_no; end if;
    if v_loc_zone is distinct from v_prod.zone_id then raise exception 'ZONE_MISMATCH:%', v_lot.lot_no; end if;
    if v_lot.status <> 'available' then raise exception 'LOT_QUARANTINED:%', v_lot.lot_no; end if;
    v_last := (v_last_map ->> v_lot.product_id::text)::date;
    if v_last is not null and v_lot.expiry_date < v_last then
      v_rev := v_rev || jsonb_build_object('lot_id', v_lot.id, 'lot_no', v_lot.lot_no, 'product_id', v_lot.product_id,
        'lot_expiry', v_lot.expiry_date, 'last', v_last);
    end if;
  end loop;
  -- The same lot may appear on several entries: check the TOTAL per lot against stock
  for v_sum in select (a->>'lot_id')::uuid as lot_id, sum((a->>'qty')::int) as qty from jsonb_array_elements(p_allocations) a group by 1 loop
    if v_sum.qty > (select qty_on_hand from lots where id = v_sum.lot_id) then
      raise exception 'INSUFFICIENT_STOCK:%', (select lot_no from lots where id = v_sum.lot_id);
    end if;
  end loop;
  return v_rev;
end $$;

drop function if exists _perform_shipment(uuid, jsonb, numeric, text, text);
-- Internal: lock, validate, write. p_override_reason non-null only from an APPROVED override request.
create or replace function _perform_shipment(p_order_id uuid, p_allocations jsonb, p_ship_temp numeric, p_override_reason text, p_approver text, p_request_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order outbound_orders%rowtype; v_rev jsonb; v_item jsonb; v_alloc jsonb; v_lot lots%rowtype; v_uid uuid := auth.uid();
begin
  select * into v_order from outbound_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'open' then raise exception 'ORDER_NOT_OPEN'; end if;
  -- Serialize shipments per customer × SKU so two orders cannot both pass the 日付逆転 check
  perform pg_advisory_xact_lock(v_order.customer_id, s.product_id)
    from (select distinct product_id from outbound_lines where order_id = p_order_id order by 1) s;
  v_rev := _validate_shipment(v_order, p_allocations, p_ship_temp, true);
  if jsonb_array_length(v_rev) > 0 and p_override_reason is null then
    raise exception 'DATE_REVERSAL:%', v_rev->0->>'lot_no';
  end if;
  -- BR-EXP-02: record (once) every 消費期限-expired lot that allocation had to exclude for this order
  insert into allocation_exceptions (rule, order_id, customer_id, product_id, lot_id, lot_expiry, reference_date, decision, reason)
  select 'BR-EXP-02', p_order_id, v_order.customer_id, l.product_id, l.id, l.expiry_date,
    greatest(v_order.ship_date, (now() at time zone 'Asia/Tokyo')::date), 'blocked', 'Loại tự động khi allocation (FR-OUT-02 ①)'
  from lots l join products p on p.id = l.product_id
  where p.expiry_type = 'use_by' and l.qty_on_hand > 0
    and l.expiry_date <= greatest(v_order.ship_date, (now() at time zone 'Asia/Tokyo')::date)
    and l.product_id in (select product_id from outbound_lines where order_id = p_order_id)
  on conflict on constraint allocation_exceptions_once do nothing;
  for v_item in select * from jsonb_array_elements(v_rev) loop
    insert into allocation_exceptions (rule, order_id, customer_id, product_id, lot_id, lot_expiry, reference_date,
      decision, reason, approver_email)
    values ('BR-DATE-01', p_order_id, v_order.customer_id, (v_item->>'product_id')::int, (v_item->>'lot_id')::uuid,
      (v_item->>'lot_expiry')::date, (v_item->>'last')::date, 'overridden', p_override_reason, p_approver);
  end loop;
  for v_alloc in select a from jsonb_array_elements(p_allocations) a order by a->>'lot_id' loop
    update lots set qty_on_hand = qty_on_hand - (v_alloc->>'qty')::int where id = (v_alloc->>'lot_id')::uuid
      returning * into v_lot;
    insert into delivery_history (customer_id, product_id, lot_id, order_id, qty, expiry_date, delivered_at)
    values (v_order.customer_id, v_lot.product_id, v_lot.id, p_order_id, (v_alloc->>'qty')::int, v_lot.expiry_date, now());
  end loop;
  update outbound_orders set status = 'shipped', ship_temp_c = p_ship_temp, shipped_at = now(), shipped_by = v_uid where id = p_order_id;
  -- Any other pending exception request for this order is now moot
  update override_requests set status = 'cancelled', decided_at = now(), decision_note = 'Đơn đã được giao'
    where order_id = p_order_id and status = 'pending' and id is distinct from p_request_id;
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  values (v_uid, 'outbound.ship', 'outbound_orders', p_order_id::text, jsonb_build_object('code', v_order.code,
    'allocations', p_allocations, 'ship_temp_c', p_ship_temp, 'date_reversal_overrides', jsonb_array_length(v_rev),
    'override_reason', p_override_reason, 'approver', p_approver));
end $$;

-- Normal shipment (no exception allowed)
create or replace function confirm_shipment(p_order_id uuid, p_allocations jsonb, p_ship_temp numeric)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app_role() is null then raise exception 'NO_PROFILE'; end if;
  perform _perform_shipment(p_order_id, p_allocations, p_ship_temp, null, null, null);
end $$;

-- Maker: request a 日付逆転 exception for a shipment that is otherwise valid
create or replace function request_override(p_order_id uuid, p_allocations jsonb, p_ship_temp numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order outbound_orders%rowtype; v_id uuid; v_email text;
begin
  select email into v_email from profiles where id = auth.uid();
  if v_email is null then raise exception 'NO_PROFILE'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into v_order from outbound_orders where id = p_order_id;
  if not found or v_order.status <> 'open' then raise exception 'ORDER_NOT_OPEN'; end if;
  if jsonb_array_length(_validate_shipment(v_order, p_allocations, p_ship_temp, false)) = 0 then raise exception 'NO_REVERSAL'; end if;
  insert into override_requests (order_id, allocations, ship_temp_c, reason, requested_by, requested_email)
  values (p_order_id, p_allocations, p_ship_temp, trim(p_reason), auth.uid(), v_email) returning id into v_id;
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), 'override.request', 'override_requests', v_id::text, jsonb_build_object('order', v_order.code, 'reason', trim(p_reason)));
  return v_id;
end $$;

-- Checker: a manager who is NOT the requester approves (→ ships) or rejects (note required)
create or replace function decide_override(p_request_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_req override_requests%rowtype; v_email text;
begin
  if app_role() is distinct from 'manager' then raise exception 'FORBIDDEN'; end if;
  select email into v_email from profiles where id = auth.uid();
  select * into v_req from override_requests where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
  if v_req.requested_by = auth.uid() then raise exception 'SELF_APPROVAL'; end if;
  if p_approve then
    perform _perform_shipment(v_req.order_id, v_req.allocations, v_req.ship_temp_c,
      v_req.reason || ' (đề nghị: ' || coalesce(v_req.requested_email, '?') || ')', v_email, v_req.id);
  elsif coalesce(trim(p_note), '') = '' then
    raise exception 'REASON_REQUIRED';
  end if;
  update override_requests set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = auth.uid(), decided_email = v_email, decision_note = nullif(trim(p_note), ''), decided_at = now()
    where id = p_request_id;
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), case when p_approve then 'override.approve' else 'override.reject' end, 'override_requests',
    p_request_id::text, jsonb_build_object('order_id', v_req.order_id, 'note', p_note));
end $$;

revoke execute on function _validate_shipment(outbound_orders, jsonb, numeric, boolean) from public, anon, authenticated;
revoke execute on function _perform_shipment(uuid, jsonb, numeric, text, text, uuid) from public, anon, authenticated;
revoke execute on function confirm_shipment(uuid, jsonb, numeric) from public, anon;
revoke execute on function request_override(uuid, jsonb, numeric, text) from public, anon;
revoke execute on function decide_override(uuid, boolean, text) from public, anon;
grant execute on function confirm_shipment(uuid, jsonb, numeric) to authenticated;
grant execute on function request_override(uuid, jsonb, numeric, text) to authenticated;
grant execute on function decide_override(uuid, boolean, text) to authenticated;
