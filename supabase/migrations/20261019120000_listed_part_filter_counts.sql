-- Part categories / colours for sale, split by condition, so the catalog sidebar counts
-- only what the new/used filter shows (like listed_root_theme_counts for themes).
-- Categories carry a photo of one of their parts for the "all categories" page.
-- listed_part_filters stays until the deployed shop no longer calls it.
create or replace function public.listed_part_filter_counts()
returns table (kind text, id int, name text, rgb text, condition public.item_condition, listing_count bigint, sample_img_url text)
language sql
stable
set search_path = ''
as $$
  select 'category', pc.id, pc.name, null::text, l.condition, count(*), min(coalesce(pcol.img_url, p.img_url))
  from public.listings l
  join public.parts p on p.part_num = l.part_num
  join public.part_categories pc on pc.id = p.part_cat_id
  left join public.part_colors pcol on pcol.part_num = l.part_num and pcol.color_id = l.color_id
  where l.item_type = 'part' and l.is_published and l.stock > 0
  group by pc.id, pc.name, l.condition
  union all
  select 'color', c.id, c.name, c.rgb, l.condition, count(*), null::text
  from public.listings l
  join public.colors c on c.id = l.color_id
  where l.item_type = 'part' and l.is_published and l.stock > 0
  group by c.id, c.name, c.rgb, l.condition;
$$;

grant execute on function public.listed_part_filter_counts() to anon, authenticated;
