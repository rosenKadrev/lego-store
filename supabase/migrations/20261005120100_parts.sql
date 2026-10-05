-- =====================================================================
-- Parts: a standalone catalog (not linked to sets/minifigs).
-- Sold per piece as part + colour, new or used, stock in pieces.
--   part_categories, colors, parts, elements  <- Rebrickable CSVs
--   part_colors <- distinct (part, colour) from inventory_parts, with the photo
--                  (the only place Rebrickable has part images)
-- =====================================================================

create table public.part_categories (
  id   int primary key,
  name text not null
);

create table public.colors (
  id       int primary key,
  name     text not null,
  rgb      text not null,          -- hex without '#', e.g. 'C91A09'
  is_trans boolean not null default false
);

create table public.parts (
  part_num    text primary key,
  name        text not null,
  part_cat_id int references public.part_categories (id),
  img_url     text                 -- a representative photo (any colour)
);
create index parts_cat_idx on public.parts (part_cat_id);
create index parts_name_trgm_idx on public.parts using gin (name extensions.gin_trgm_ops);
create index parts_part_num_trgm_idx on public.parts using gin (part_num extensions.gin_trgm_ops);

-- Colours a part is known to exist in (from set inventories), with that colour's photo
create table public.part_colors (
  part_num text not null references public.parts (part_num) on delete cascade,
  color_id int  not null references public.colors (id),
  img_url  text,
  primary key (part_num, color_id)
);

-- LEGO element IDs (part + colour), for searching by the number printed on Pick a Brick etc.
create table public.elements (
  element_id text primary key,
  part_num   text not null,
  color_id   int  not null
);
create index elements_part_color_idx on public.elements (part_num, color_id);

-- ---------------------------------------------------------------------
-- Listings: parts are part_num + color_id
-- ---------------------------------------------------------------------

alter table public.listings
  add column part_num text references public.parts (part_num),
  add column color_id int  references public.colors (id);
create index listings_part_idx on public.listings (part_num, color_id);

alter table public.listings drop constraint listings_item_ref;
alter table public.listings add constraint listings_item_ref check (
  (item_type = 'set'     and set_num is not null and fig_num is null and part_num is null and color_id is null) or
  (item_type = 'minifig' and fig_num is not null and set_num is null and part_num is null and color_id is null) or
  (item_type = 'part'    and part_num is not null and color_id is not null and set_num is null and fig_num is null)
);

-- A used set/minifig is one physical item; used parts are sold in any quantity
alter table public.listings drop constraint listings_used_single;
alter table public.listings add constraint listings_used_single
  check (condition = 'new' or item_type = 'part' or stock <= 1);

-- Storefront view: existing columns keep their order, part columns are appended
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
  coalesce(l.set_num, l.fig_num, l.part_num)            as item_num,
  coalesce(s.name, m.name, p.name)                      as name,
  coalesce(s.num_parts, m.num_parts)                    as num_parts,
  coalesce(s.img_url, m.img_url, pc.img_url, p.img_url) as catalog_img_url,
  s.year,
  s.theme_id,
  t.name                                                as theme_name,
  (select li.path from public.listing_images li
    where li.listing_id = l.id order by li.sort_order, li.id limit 1) as cover_path,
  l.color_id,
  c.name                                                as color_name,
  c.rgb                                                 as color_rgb,
  p.part_cat_id,
  pcat.name                                             as part_category
from public.listings l
left join public.sets s               on s.set_num = l.set_num
left join public.minifigs m           on m.fig_num = l.fig_num
left join public.themes t             on t.id = s.theme_id
left join public.parts p              on p.part_num = l.part_num
left join public.part_colors pc       on pc.part_num = l.part_num and pc.color_id = l.color_id
left join public.colors c             on c.id = l.color_id
left join public.part_categories pcat on pcat.id = p.part_cat_id;

-- Part categories / colours that currently have published, in-stock part listings (shop filters)
create or replace function public.listed_part_filters()
returns table (kind text, id int, name text, rgb text, listing_count bigint)
language sql
stable
set search_path = ''
as $$
  select 'category', pc.id, pc.name, null::text, count(*)
  from public.listings l
  join public.parts p on p.part_num = l.part_num
  join public.part_categories pc on pc.id = p.part_cat_id
  where l.item_type = 'part' and l.is_published and l.stock > 0
  group by pc.id, pc.name
  union all
  select 'color', c.id, c.name, c.rgb, count(*)
  from public.listings l
  join public.colors c on c.id = l.color_id
  where l.item_type = 'part' and l.is_published and l.stock > 0
  group by c.id, c.name, c.rgb
  order by 1, 5 desc, 3;
$$;

-- Order snapshot: part listings are named "<part> — <colour>"
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

  insert into public.orders (
    user_id, customer_name, phone, email, delivery_type, courier,
    office_code, address, city, note, subtotal, shipping_price, total
  ) values (
    (select auth.uid()), p_customer_name, p_phone, p_email, p_delivery_type, p_courier,
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
    returning l.id, l.price, l.condition, l.set_num, l.fig_num, l.part_num, l.color_id
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
                 where p.part_num = v_listing.part_num and c.id = v_listing.color_id)),
      coalesce(v_listing.set_num, v_listing.fig_num, v_listing.part_num),
      v_listing.condition,
      v_listing.price,
      v_item.quantity
    );

    v_subtotal := v_subtotal + v_listing.price * v_item.quantity;
  end loop;

  v_shipping := case
    when v_subtotal >= v_settings.free_shipping_threshold then 0
    when p_delivery_type = 'office' then v_settings.shipping_price_office
    else v_settings.shipping_price_address
  end;

  update public.orders
     set subtotal = v_subtotal, shipping_price = v_shipping, total = v_subtotal + v_shipping
   where id = v_order_id;

  insert into public.order_status_history (order_id, status, changed_by)
  values (v_order_id, 'new', (select auth.uid()));

  return query select v_order_id, v_number, v_subtotal + v_shipping;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS + grants (catalog: public read, admin write; bulk import uses the service role)
-- ---------------------------------------------------------------------

alter table public.part_categories enable row level security;
alter table public.colors          enable row level security;
alter table public.parts           enable row level security;
alter table public.part_colors     enable row level security;
alter table public.elements        enable row level security;

create policy "catalog read" on public.part_categories for select using (true);
create policy "catalog read" on public.colors          for select using (true);
create policy "catalog read" on public.parts           for select using (true);
create policy "catalog read" on public.part_colors     for select using (true);
create policy "catalog read" on public.elements        for select using (true);
create policy "admin write"  on public.part_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.colors          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.parts           for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.part_colors     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.elements        for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.part_categories, public.colors, public.parts, public.part_colors, public.elements
  to anon, authenticated;
grant insert, update, delete on public.part_categories, public.colors, public.parts, public.part_colors, public.elements
  to authenticated;
grant select on public.catalog_listings to anon, authenticated;
grant execute on function public.listed_part_filters to anon, authenticated;
