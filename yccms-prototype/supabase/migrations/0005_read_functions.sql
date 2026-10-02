-- YCCMS prototype — read-side aggregates (SECURITY INVOKER → RLS applies; not subject to the API row cap)

-- Latest expiry delivered per customer × SKU pair (BR-DATE-01 reference)
create or replace function last_deliveries(p_customer_ids int[], p_product_ids int[])
returns table (customer_id int, product_id int, expiry_date date, lot_no text, delivered_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select distinct on (d.customer_id, d.product_id) d.customer_id, d.product_id, d.expiry_date, l.lot_no, d.delivered_at
  from delivery_history d join lots l on l.id = d.lot_id
  where d.customer_id = any(p_customer_ids) and d.product_id = any(p_product_ids)
  order by d.customer_id, d.product_id, d.expiry_date desc, d.delivered_at desc
$$;

-- Delivery count + last delivery per customer
create or replace function customer_delivery_summary()
returns table (customer_id int, deliveries int, last_delivered_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select c.id, count(d.id)::int, max(d.delivered_at)
  from customers c left join delivery_history d on d.customer_id = c.id group by c.id
$$;

revoke execute on function last_deliveries(int[], int[]) from public, anon;
revoke execute on function customer_delivery_summary() from public, anon;
grant execute on function last_deliveries(int[], int[]) to authenticated;
grant execute on function customer_delivery_summary() to authenticated;
