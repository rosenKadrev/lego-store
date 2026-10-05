-- =====================================================================
-- Courier shipping price is agreed by phone: NULL until staff sets it.
--   orders.shipping_price NULL = "to be confirmed"; total = subtotal + shipping (when known)
--   set_order_shipping(): admin enters the price, total is recalculated
-- =====================================================================

alter table public.orders alter column shipping_price drop not null;

create or replace function public.place_order(
  p_customer_name text,
  p_phone         text,
  p_email         text,
  p_delivery_type public.delivery_type,
  p_courier       public.courier,
  p_items         jsonb,
  p_office_code   text default null,
  p_address       text default null,
  p_city          text default null,
  p_note          text default null
)
returns table (order_id bigint, order_number text, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id bigint;
  v_number   text;
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2);
  v_settings public.shop_settings;
  v_item     record;
  v_listing  record;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_phone), '') = ''
     or coalesce(trim(p_email), '') = '' then
    raise exception 'Name, phone and email are required';
  end if;

  select * into v_settings from public.shop_settings;

  if p_delivery_type = 'pickup' then
    if not v_settings.pickup_enabled then
      raise exception 'Pickup is not available';
    end if;
  elsif p_courier is null then
    raise exception 'Courier is required for delivery';
  end if;

  insert into public.orders (
    user_id, customer_name, phone, email, delivery_type, courier,
    office_code, address, city, note, subtotal, shipping_price, total
  ) values (
    (select auth.uid()), p_customer_name, p_phone, p_email, p_delivery_type,
    case when p_delivery_type = 'pickup' then null else p_courier end,
    p_office_code, p_address, p_city, p_note, 0, 0, 0
  )
  returning id, number into v_order_id, v_number;

  -- Sort by listing id so concurrent orders lock rows in the same order (no deadlocks)
  for v_item in
    select (e ->> 'listing_id')::bigint as listing_id, sum((e ->> 'quantity')::int) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Invalid quantity for listing %', v_item.listing_id;
    end if;

    -- Conditional update = row lock + stock check in one step
    update public.listings l
       set stock = l.stock - v_item.quantity
     where l.id = v_item.listing_id
       and l.is_published
       and l.stock >= v_item.quantity
    returning l.id, l.price, l.condition, l.set_num, l.fig_num, l.part_num, l.color_id, l.box_damaged
      into v_listing;

    if not found then
      raise exception 'OUT_OF_STOCK:%', v_item.listing_id
        using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, listing_id, name, item_num, condition, unit_price, quantity)
    values (
      v_order_id,
      v_listing.id,
      coalesce((select s.name from public.sets s where s.set_num = v_listing.set_num),
               (select m.name from public.minifigs m where m.fig_num = v_listing.fig_num),
               (select p.name || ' — ' || c.name from public.parts p, public.colors c
                 where p.part_num = v_listing.part_num and c.id = v_listing.color_id))
        || case when v_listing.box_damaged then ' (ударена кутия)' else '' end,
      coalesce(v_listing.set_num, v_listing.fig_num, v_listing.part_num),
      v_listing.condition,
      v_listing.price,
      v_item.quantity
    );

    v_subtotal := v_subtotal + v_listing.price * v_item.quantity;
  end loop;

  -- Courier price is confirmed by staff later (set_order_shipping); pickup is free
  v_shipping := case when p_delivery_type = 'pickup' then 0 end;

  update public.orders
     set subtotal = v_subtotal, shipping_price = v_shipping, total = v_subtotal + coalesce(v_shipping, 0)
   where id = v_order_id;

  insert into public.order_status_history (order_id, status, changed_by)
  values (v_order_id, 'new', (select auth.uid()));

  return query select v_order_id, v_number, v_subtotal + coalesce(v_shipping, 0);
end;
$$;

create or replace function public.set_order_shipping(p_order_id bigint, p_shipping_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if p_shipping_price is null or p_shipping_price < 0 then
    raise exception 'Invalid shipping price';
  end if;

  update public.orders
     set shipping_price = round(p_shipping_price, 2),
         total = subtotal + round(p_shipping_price, 2)
   where id = p_order_id and delivery_type <> 'pickup';
  if not found then
    raise exception 'Order % not found or is a pickup order', p_order_id;
  end if;
end;
$$;

revoke execute on function public.set_order_shipping from public, anon;
grant execute on function public.set_order_shipping to authenticated;
