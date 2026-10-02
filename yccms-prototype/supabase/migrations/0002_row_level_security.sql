-- YCCMS prototype — Row Level Security: read = provisioned users; writes only via SECURITY DEFINER
-- RPCs or the narrow policies below (manager config columns, blocked-exception log, own audit rows).

-- Role of the caller from profiles (SECURITY DEFINER → usable inside policies). NULL = not provisioned.
create or replace function app_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke execute on function app_role() from public, anon;
grant execute on function app_role() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['temperature_zones','locations','suppliers','customers','products',
    'customer_sku_agreements','inbound_receipts','inbound_lines','lots','outbound_orders','outbound_lines',
    'delivery_history','allocation_exceptions','override_requests','profiles','audit_logs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists provisioned_read on %I', t);
    execute format('create policy provisioned_read on %I for select to authenticated using (app_role() is not null)', t);
    execute format('revoke all on %I from anon', t);
    execute format('revoke insert, update, delete, truncate on %I from authenticated', t);
    execute format('grant select on %I to authenticated', t);
  end loop;
end $$;

-- Business config: manager only, and only the configurable COLUMNS
do $$
declare t text;
begin
  foreach t in array array['temperature_zones','products','customer_sku_agreements'] loop
    execute format('drop policy if exists manager_update on %I', t);
    execute format('create policy manager_update on %I for update to authenticated using (app_role() = ''manager'') with check (app_role() = ''manager'')', t);
  end loop;
end $$;
grant update (min_c, max_c, updated_at) on temperature_zones to authenticated;
grant update (expiry_type, near_expiry_days, updated_at) on products to authenticated;
grant update (window_rule, updated_at) on customer_sku_agreements to authenticated;

-- Blocked attempts are logged by the API (content re-derived by trigger below); no update/delete ever.
drop policy if exists log_blocked on allocation_exceptions;
create policy log_blocked on allocation_exceptions for insert to authenticated
  with check (app_role() is not null and decision = 'blocked' and actor_id = auth.uid());
grant insert on allocation_exceptions to authenticated;

-- Audit trail: append-only, actor must be the caller.
drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert to authenticated
  with check (app_role() is not null and actor_id = auth.uid());
grant insert on audit_logs to authenticated;
grant usage on sequence audit_logs_id_seq to authenticated;

-- Log integrity: actor stamped server-side from the JWT (seed/setup without JWT keep their values).
create or replace function stamp_actor() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
    new.actor_email := (select email from profiles where id = auth.uid());
  end if;
  return new;
end $$;

-- A "blocked" exception must describe a REAL violation; every field is re-derived from the database.
create or replace function verify_blocked_exception() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ship date; v_type text;
begin
  if new.decision <> 'blocked' then return new; end if;
  select customer_id, ship_date into new.customer_id, v_ship from outbound_orders where id = new.order_id and status = 'open';
  select l.product_id, l.expiry_date, p.expiry_type into new.product_id, new.lot_expiry, v_type
    from lots l join products p on p.id = l.product_id where l.id = new.lot_id;
  if new.customer_id is null or new.product_id is null
     or not exists (select 1 from outbound_lines where order_id = new.order_id and product_id = new.product_id) then
    raise exception 'NOT_A_VIOLATION';
  end if;
  if new.rule = 'BR-DATE-01' then
    select max(expiry_date) into new.reference_date from delivery_history
      where customer_id = new.customer_id and product_id = new.product_id;
    if new.reference_date is null or new.lot_expiry >= new.reference_date then raise exception 'NOT_A_VIOLATION'; end if;
  else -- BR-EXP-02: 消費期限 reached or passed on the (actual) ship date
    new.reference_date := greatest(v_ship, (now() at time zone 'Asia/Tokyo')::date);
    if v_type <> 'use_by' or new.lot_expiry > new.reference_date then raise exception 'NOT_A_VIOLATION'; end if;
  end if;
  return new;
end $$;

drop trigger if exists audit_logs_stamp_actor on audit_logs;
create trigger audit_logs_stamp_actor before insert on audit_logs for each row execute function stamp_actor();
drop trigger if exists allocation_exceptions_stamp_actor on allocation_exceptions;
create trigger allocation_exceptions_stamp_actor before insert on allocation_exceptions for each row execute function stamp_actor();
drop trigger if exists allocation_exceptions_verify on allocation_exceptions;
create trigger allocation_exceptions_verify before insert on allocation_exceptions for each row execute function verify_blocked_exception();
revoke execute on function stamp_actor() from public, anon, authenticated;
revoke execute on function verify_blocked_exception() from public, anon, authenticated;

-- One event per rule × order × lot × decision (repeated attempts do not flood the immutable log)
do $$ begin
  alter table allocation_exceptions add constraint allocation_exceptions_once unique (rule, order_id, lot_id, decision);
exception when duplicate_table or duplicate_object then null; end $$;

-- Config changes are audited by the DATABASE (before → after), whatever path made them
create or replace function audit_config_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(), tg_table_name || '.update', tg_table_name, new.id::text,
    jsonb_build_object('before', to_jsonb(old) - 'updated_at', 'after', to_jsonb(new) - 'updated_at'));
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['temperature_zones','products','customer_sku_agreements'] loop
    execute format('drop trigger if exists %I on %I', t || '_audit', t);
    execute format('create trigger %I after update on %I for each row when (old is distinct from new) execute function audit_config_change()', t || '_audit', t);
  end loop;
end $$;
revoke execute on function audit_config_change() from public, anon, authenticated;
