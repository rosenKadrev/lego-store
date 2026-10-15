-- Listings for sale per top-level theme, split by kind and condition, so the catalog sidebar
-- can count only what the current filters show (e.g. magazines only)
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
  select tree.root_id, l.item_type, l.condition, count(*)
  from public.listings l
  left join public.sets s on s.set_num = l.set_num
  join tree on tree.id = coalesce(s.theme_id, l.theme_id)
  where l.is_published and l.stock > 0
  group by tree.root_id, l.item_type, l.condition;
$$;
