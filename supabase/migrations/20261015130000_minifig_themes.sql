-- Minifigs get the theme of the sets they appear in, so the catalog can filter, count and sort
-- them by theme like sets (the view is otherwise unchanged from 20261007150100_magazines.sql).
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
  coalesce(s.name, m.name, p.name, l.title)             as name,
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
    where e.part_num = l.part_num and e.color_id = l.color_id) as element_ids
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


-- Theme counts go through the view, so minifigs are counted under their sets' theme too

create or replace function public.listed_root_themes()
returns table (theme_id int, name text, listing_count bigint, sample_img_url text)
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select t.id, t.id as root_id from public.themes t where t.parent_id is null
    union all
    select c.id, tree.root_id from public.themes c join tree on c.parent_id = tree.id
  )
  select r.id, r.name, count(*), min(cl.catalog_img_url) filter (where cl.item_type = 'set')
  from public.catalog_listings cl
  join tree on tree.id = cl.theme_id
  join public.themes r on r.id = tree.root_id
  where cl.is_published and cl.stock > 0
  group by r.id, r.name
  order by count(*) desc, r.name;
$$;

create or replace function public.listed_root_theme_counts()
returns table (theme_id int, item_type public.item_type, condition public.item_condition, listing_count bigint)
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select t.id, t.id as root_id from public.themes t where t.parent_id is null
    union all
    select c.id, tree.root_id from public.themes c join tree on c.parent_id = tree.id
  )
  select tree.root_id, cl.item_type, cl.condition, count(*)
  from public.catalog_listings cl
  join tree on tree.id = cl.theme_id
  where cl.is_published and cl.stock > 0
  group by tree.root_id, cl.item_type, cl.condition;
$$;
