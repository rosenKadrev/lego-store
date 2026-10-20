-- Shop sidebar counts that follow the active filters (faceted search).
-- listed_root_theme_counts / listed_part_filter_counts count everything for sale, so with a price range or a colour
-- picked the sidebar still promised e.g. "Technic оси 12" while the list showed 2.
-- Each facet applies every filter except its own (picking a colour still shows the other colours' counts).
-- The predicates mirror CatalogStore.load() and searchFilter() in the app.

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

grant execute on function public.catalog_facet_counts(public.item_condition, public.item_type, int, int, int, numeric, numeric, text)
  to anon, authenticated;
