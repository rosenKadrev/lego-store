-- Bulgarian set names. Rebrickable's names are English; `name_bg` comes from Bulgarian shops
-- (or the admin) and is never touched by the catalog sync, which upserts only its own columns.
alter table public.sets add column name_bg text;

-- The storefront shows the Bulgarian name; the English one stays available as name_en
-- (otherwise the view is unchanged from 20261015130000_minifig_themes.sql)
create or replace view public.catalog_listings
with (security_invoker = true)
as
select
  l.id,
  l.item_type,
  l.condition,
  l.price,
  l.compare_at_price,
  l.stock,
  l.has_box,
  l.has_instructions,
  l.is_complete,
  l.minifigs_complete,
  l.condition_notes,
  l.description,
  l.is_published,
  l.created_at,
  coalesce(l.set_num, l.fig_num, l.part_num, 'M-' || l.id) as item_num,
  coalesce(s.name_bg, s.name, m.name, p.name, l.title) as name,
  coalesce(s.num_parts, m.num_parts)                    as num_parts,
  coalesce(s.img_url, m.img_url, pc.img_url, p.img_url) as catalog_img_url,
  s.year,
  coalesce(s.theme_id, l.theme_id, mf.theme_id)         as theme_id,
  t.name                                                as theme_name,
  (select li.path from public.listing_images li
    where li.listing_id = l.id order by li.sort_order, li.id limit 1) as cover_path,
  l.color_id,
  c.name                                                as color_name,
  c.rgb                                                 as color_rgb,
  p.part_cat_id,
  pcat.name                                             as part_category,
  l.box_damaged,
  -- LEGO element IDs (part + colour) — several per combination, newest first; null for sets/minifigs
  (select array_agg(e.element_id order by length(e.element_id) desc, e.element_id desc)
     from public.elements e
    where e.part_num = l.part_num and e.color_id = l.color_id) as element_ids,
  -- The original (Rebrickable) name, shown under the Bulgarian one and searchable
  case when s.name_bg is not null then s.name end       as name_en
from public.listings l
left join public.sets s               on s.set_num = l.set_num
left join public.minifigs m           on m.fig_num = l.fig_num
-- Minifigs have no theme of their own: take the one of the sets they appear in most often
left join lateral (
  select ms.theme_id
  from public.set_minifigs sm
  join public.sets ms on ms.set_num = sm.set_num
  where sm.fig_num = l.fig_num
  group by ms.theme_id
  order by count(*) desc, ms.theme_id
  limit 1
) mf on l.fig_num is not null
left join public.themes t             on t.id = coalesce(s.theme_id, l.theme_id, mf.theme_id)
left join public.parts p              on p.part_num = l.part_num
left join public.part_colors pc       on pc.part_num = l.part_num and pc.color_id = l.color_id
left join public.colors c             on c.id = l.color_id
left join public.part_categories pcat on pcat.id = p.part_cat_id;


-- Order lines keep the name the customer saw (otherwise unchanged from 20261007150100_magazines.sql)
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
    returning l.id, l.price, l.condition, l.set_num, l.fig_num, l.part_num, l.color_id, l.box_damaged, l.title
      into v_listing;

    if not found then
      raise exception 'OUT_OF_STOCK:%', v_item.listing_id
        using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, listing_id, name, item_num, condition, unit_price, quantity)
    values (
      v_order_id,
      v_listing.id,
      coalesce((select coalesce(s.name_bg, s.name) from public.sets s where s.set_num = v_listing.set_num),
               (select m.name from public.minifigs m where m.fig_num = v_listing.fig_num),
               (select p.name || ' — ' || c.name from public.parts p, public.colors c
                 where p.part_num = v_listing.part_num and c.id = v_listing.color_id),
               v_listing.title)
        || case when v_listing.box_damaged then ' (ударена кутия)' else '' end,
      coalesce(v_listing.set_num, v_listing.fig_num, v_listing.part_num, 'M-' || v_listing.id),
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

