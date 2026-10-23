-- Minifig theme pictures: also the newest minifig listing's own photo, for themes whose minifigs have no
-- Rebrickable image (custom figures) or a broken one — the app falls back to it (ThemeImage in themes.store.ts).
-- The return type changes, so the function is recreated (otherwise as in 20261019150000_theme_samples_per_kind.sql).
drop function if exists public.listed_root_themes();

create function public.listed_root_themes()
returns table (
  theme_id int, name text, listing_count bigint, sample_img_url text, minifig_img_url text, magazine_cover_path text,
  minifig_cover_path text
)
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
       filter (where cl.item_type = 'magazine' and cl.cover_path is not null))[1],
    (array_agg(cl.cover_path order by cl.created_at desc)
       filter (where cl.item_type = 'minifig' and cl.cover_path is not null))[1]
  from public.catalog_listings cl
  join tree on tree.id = cl.theme_id
  join public.themes r on r.id = tree.root_id
  where cl.is_published and cl.stock > 0
  group by r.id, r.name
  order by count(*) desc, r.name;
$$;

grant execute on function public.listed_root_themes() to anon, authenticated;
