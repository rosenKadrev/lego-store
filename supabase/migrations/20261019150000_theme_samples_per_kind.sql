-- Theme pictures per kind: the minifig / magazine theme pages and menus show a minifig or a magazine
-- of that theme instead of a set. Minifigs have Rebrickable photos; magazines only the shop's own
-- photos (the newest listing's cover, a path in the listing-images bucket).
-- The return type changes, so the function is recreated (otherwise as in 20261015130000_minifig_themes.sql).
drop function if exists public.listed_root_themes();

create function public.listed_root_themes()
returns table (theme_id int, name text, listing_count bigint, sample_img_url text, minifig_img_url text, magazine_cover_path text)
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select t.id, t.id as root_id from public.themes t where t.parent_id is null
    union all
    select c.id, tree.root_id from public.themes c join tree on c.parent_id = tree.id
  )
  select
    r.id,
    r.name,
    count(*),
    min(cl.catalog_img_url) filter (where cl.item_type = 'set'),
    min(cl.catalog_img_url) filter (where cl.item_type = 'minifig'),
    (array_agg(cl.cover_path order by cl.created_at desc)
       filter (where cl.item_type = 'magazine' and cl.cover_path is not null))[1]
  from public.catalog_listings cl
  join tree on tree.id = cl.theme_id
  join public.themes r on r.id = tree.root_id
  where cl.is_published and cl.stock > 0
  group by r.id, r.name
  order by count(*) desc, r.name;
$$;

grant execute on function public.listed_root_themes() to anon, authenticated;
