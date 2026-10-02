-- YCCMS prototype — inbound inspection (FR-REC-02..05) and quarantine resolution (FR-INV-05).
-- SECURITY DEFINER: app users have no direct write grants; each function re-checks caller + rules.

create or replace function confirm_inbound_receipt(p_supplier_id int, p_arrival_date date, p_note text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid; v_code text; v_line jsonb; v_line_id uuid; v_uid uuid := auth.uid(); v_role text; v_email text;
  v_prod products%rowtype; v_zone temperature_zones%rowtype; v_loc locations%rowtype;
  v_temp numeric; v_ok boolean; v_result text; v_trace text;
begin
  select role, email into v_role, v_email from profiles where id = v_uid;
  if v_uid is null or v_role is null then raise exception 'NO_PROFILE'; end if;
  if not exists (select 1 from suppliers where id = p_supplier_id) then raise exception 'INVALID_SUPPLIER'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) = 0 then raise exception 'NO_LINES'; end if;
  if p_arrival_date is null or p_arrival_date > (now() at time zone 'Asia/Tokyo')::date
     or p_arrival_date < (now() at time zone 'Asia/Tokyo')::date - 7 then
    raise exception 'INVALID_ARRIVAL_DATE';   -- no back/forward-dating around the expiry checks
  end if;

  v_code := 'IN-' || to_char(p_arrival_date, 'YYMMDD') || '-' || lpad(nextval('inbound_receipt_seq')::text, 4, '0');
  insert into inbound_receipts (code, supplier_id, arrival_date, note, created_by)
  values (v_code, p_supplier_id, p_arrival_date, p_note, v_uid) returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_prod from products where id = (v_line->>'product_id')::int;
    if not found then raise exception 'INVALID_PRODUCT'; end if;
    select * into v_zone from temperature_zones where id = v_prod.zone_id;
    v_temp := (v_line->>'temp_c')::numeric;
    if v_temp is null then raise exception 'TEMP_REQUIRED:%', v_prod.sku; end if;
    v_ok := (v_zone.min_c is null or v_temp >= v_zone.min_c) and (v_zone.max_c is null or v_temp <= v_zone.max_c);
    v_result := v_line->>'result';
    if v_result not in ('accepted', 'rejected', 'hold') then raise exception 'INVALID_RESULT:%', v_prod.sku; end if;
    if not v_ok and (v_result = 'accepted' or coalesce(trim(v_line->>'temp_note'), '') = '') then
      raise exception 'TEMP_DEVIATION:%', v_prod.sku;   -- deviation → reject or hold (隔離) with a note
    end if;
    if v_result = 'accepted' and v_prod.expiry_type = 'use_by' and (v_line->>'expiry_date')::date <= p_arrival_date then
      raise exception 'EXPIRED_ON_ARRIVAL:%', v_prod.sku;
    end if;
    v_trace := nullif(trim(v_line->>'trace_code'), '');
    if v_result <> 'rejected' and v_prod.trace_lane = 'rice' and v_trace is null then raise exception 'RICE_TRACE_REQUIRED:%', v_prod.sku; end if;
    if v_result <> 'rejected' and v_prod.trace_lane = 'beef' and coalesce(v_trace, '') !~ '^[0-9]{10}$' then
      if coalesce(v_trace, '') ~ '^[0-9]{9}$' then raise exception 'BEEF_ID_REVIEW:%', v_prod.sku; end if;
      raise exception 'BEEF_ID_INVALID:%', v_prod.sku;
    end if;
    select * into v_loc from locations where id = nullif(v_line->>'location_id', '')::int;
    if v_result <> 'rejected' and (v_loc.id is null or v_loc.zone_id <> v_prod.zone_id
       or v_loc.is_quarantine <> (v_result = 'hold')) then
      raise exception 'INVALID_LOCATION:%', v_prod.sku;
    end if;

    insert into inbound_lines (receipt_id, product_id, lot_no, mfg_date, expiry_date, qty, temp_c,
      temp_ok, temp_note, trace_code, location_id, result)
    values (v_id, v_prod.id, trim(v_line->>'lot_no'), (v_line->>'mfg_date')::date, (v_line->>'expiry_date')::date,
      (v_line->>'qty')::int, v_temp, v_ok, nullif(trim(v_line->>'temp_note'), ''), v_trace,
      case when v_result = 'rejected' then null else v_loc.id end, v_result)
    returning id into v_line_id;

    if v_result <> 'rejected' then
      insert into lots (product_id, supplier_id, inbound_line_id, lot_no, mfg_date, expiry_date,
        qty_received, qty_on_hand, location_id, status, trace_code)
      values (v_prod.id, p_supplier_id, v_line_id, trim(v_line->>'lot_no'), (v_line->>'mfg_date')::date,
        (v_line->>'expiry_date')::date, (v_line->>'qty')::int, (v_line->>'qty')::int, v_loc.id,
        case when v_result = 'hold' then 'quarantine' else 'available' end, v_trace);
    end if;
  end loop;

  insert into audit_logs (actor_id, actor_email, action, entity, entity_id, detail)
  values (v_uid, v_email, 'inbound.confirm', 'inbound_receipts', v_id::text,
    jsonb_build_object('code', v_code, 'lines', jsonb_array_length(p_lines)));
  return v_id;
end $$;

-- Quarantine state machine (FR-INV-05): quarantine → release (to a normal location of the same band) | scrap.
create or replace function resolve_quarantine(p_lot_id uuid, p_action text, p_location_id int, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_role text; v_email text; v_lot lots%rowtype; v_zone smallint; v_loc locations%rowtype;
begin
  select role, email into v_role, v_email from profiles where id = v_uid;
  if v_role is null then raise exception 'NO_PROFILE'; end if;
  if v_role <> 'manager' then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into v_lot from lots where id = p_lot_id for update;
  if not found or v_lot.status <> 'quarantine' then raise exception 'LOT_NOT_QUARANTINED'; end if;
  select zone_id into v_zone from products where id = v_lot.product_id;
  if p_action = 'release' then
    select * into v_loc from locations where id = p_location_id;
    if v_loc.id is null or v_loc.is_quarantine or v_loc.zone_id <> v_zone then raise exception 'INVALID_LOCATION'; end if;
    update lots set status = 'available', location_id = v_loc.id where id = p_lot_id;
  elsif p_action = 'scrap' then
    update lots set status = 'scrapped', qty_on_hand = 0 where id = p_lot_id;
  else
    raise exception 'INVALID_ACTION';
  end if;
  insert into audit_logs (actor_id, actor_email, action, entity, entity_id, detail)
  values (v_uid, v_email, 'quarantine.' || p_action, 'lots', p_lot_id::text,
    jsonb_build_object('lot_no', v_lot.lot_no, 'qty', v_lot.qty_on_hand, 'location', v_loc.code, 'reason', p_reason));
end $$;

revoke execute on function confirm_inbound_receipt(int, date, text, jsonb) from public, anon;
revoke execute on function resolve_quarantine(uuid, text, int, text) from public, anon;
grant execute on function confirm_inbound_receipt(int, date, text, jsonb) to authenticated;
grant execute on function resolve_quarantine(uuid, text, int, text) to authenticated;
