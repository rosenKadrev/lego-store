-- The minifig's real number (BrickLink: sw1094, twn542, njo123…) — what buyers search for. Rebrickable's
-- data only has its own fig-013395, so the admin types it in on the listing form. Kept on the catalog
-- row (not the listing), so every offer of the same figure shows and finds it.
alter table public.minifigs add column bl_num text;
create unique index minifigs_bl_num_key on public.minifigs (lower(bl_num));

-- Same view as 20261019130000_part_categories_bg.sql plus bl_num at the end
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
  coalesce(pcat.name_bg, pcat.name)                     as part_category,
  l.box_damaged,
  -- LEGO element IDs (part + colour) — several per combination, newest first; null for sets/minifigs
  (select array_agg(e.element_id order by length(e.element_id) desc, e.element_id desc)
     from public.elements e
    where e.part_num = l.part_num and e.color_id = l.color_id) as element_ids,
  -- The original (Rebrickable) name, shown under the Bulgarian one and searchable
  case when s.name_bg is not null then s.name end       as name_en,
  m.bl_num
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

-- Sidebar counts: the search also matches bl_num (as searchFilter() in the app)
create or replace function public.catalog_facet_counts(
  p_condition public.item_condition default null,
  p_type      public.item_type default null,
  p_theme     int default null,
  p_color     int default null,
  p_category  int default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_q         text default null
)
returns table (kind text, id int, listing_count bigint)
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    -- every theme with each of its ancestors (itself included); parent_id is the ancestor's parent
    select t.id, t.id as ancestor_id, t.parent_id from public.themes t
    union all
    select tree.id, a.id, a.parent_id from tree join public.themes a on a.id = tree.parent_id
  ),
  base as (
    select
      cl.theme_id,
      cl.color_id,
      cl.part_cat_id,
      p_theme is null or exists (select 1 from tree where tree.id = cl.theme_id and tree.ancestor_id = p_theme) as theme_ok,
      p_color is null or cl.color_id = p_color as color_ok,
      p_category is null or cl.part_cat_id = p_category as category_ok
    from public.catalog_listings cl
    where cl.is_published
      and cl.stock > 0
      and (p_condition is null or cl.condition = p_condition)
      and (p_type is null or cl.item_type = p_type)
      -- "all products" leaves loose parts out unless searching or filtering by a part's colour / category
      and (p_type is not null or nullif(p_q, '') is not null or p_color is not null or p_category is not null
           or cl.item_type <> 'part')
      and (p_min_price is null or cl.price >= p_min_price)
      and (p_max_price is null or cl.price <= p_max_price)
      and (nullif(p_q, '') is null
           or cl.name ilike '%' || p_q || '%'
           or cl.name_en ilike '%' || p_q || '%'
           or cl.item_num ilike p_q || '%'
           or cl.bl_num ilike p_q || '%'
           or (p_q ~ '^\d{4,8}$' and cl.element_ids @> array[p_q]))
  )
  select 'theme', tree.ancestor_id, count(*)
  from base
  join tree on tree.id = base.theme_id and tree.parent_id is null -- root themes, like the sidebar
  where base.color_ok and base.category_ok
  group by tree.ancestor_id
  union all
  select 'category', base.part_cat_id, count(*)
  from base
  where base.part_cat_id is not null and base.theme_ok and base.color_ok
  group by base.part_cat_id
  union all
  select 'color', base.color_id, count(*)
  from base
  where base.color_id is not null and base.theme_ok and base.category_ok
  group by base.color_id;
$$;
