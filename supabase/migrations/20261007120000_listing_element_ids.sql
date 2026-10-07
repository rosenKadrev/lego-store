-- Element IDs on the storefront view: buyers search parts by the number printed in
-- LEGO instructions (e.g. 6265148 = part 2569 in Black), and the product page shows it.
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
  pcat.name                                             as part_category,
  l.box_damaged,
  -- LEGO element IDs (part + colour) — several per combination, newest first; null for sets/minifigs
  (select array_agg(e.element_id order by length(e.element_id) desc, e.element_id desc)
     from public.elements e
    where e.part_num = l.part_num and e.color_id = l.color_id) as element_ids
from public.listings l
left join public.sets s               on s.set_num = l.set_num
left join public.minifigs m           on m.fig_num = l.fig_num
left join public.themes t             on t.id = s.theme_id
left join public.parts p              on p.part_num = l.part_num
left join public.part_colors pc       on pc.part_num = l.part_num and pc.color_id = l.color_id
left join public.colors c             on c.id = l.color_id
left join public.part_categories pcat on pcat.id = p.part_cat_id;
