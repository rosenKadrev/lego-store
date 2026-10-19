-- Bulgarian part category names. Rebrickable's names are English; `name_bg` is never touched by the
-- catalog sync, which upserts only its own columns. A category Rebrickable adds later shows in English
-- until it gets a name here. Brand / product line names (Duplo, Technic, Modulex…) stay as they are.
alter table public.part_categories add column name_bg text;

update public.part_categories pc set name_bg = v.name_bg
from (values
  (1, 'Основи'),
  (3, 'Скосени тухлички'),
  (4, 'Duplo, Quatro и Primo'),
  (5, 'Специални тухлички'),
  (6, 'Клиновидни тухлички'),
  (7, 'Контейнери'),
  (8, 'Technic тухлички'),
  (9, 'Специални плочки'),
  (11, 'Тухлички'),
  (12, 'Technic съединители'),
  (13, 'Минифигурки'),
  (14, 'Плочки'),
  (15, 'Специални гладки плочки'),
  (16, 'Прозорци и врати'),
  (17, 'Сувенири и аксесоари (Gear)'),
  (18, 'Панти, рамена и въртящи се основи'),
  (19, 'Гладки плочки'),
  (20, 'Кръгли тухлички и конуси'),
  (21, 'Кръгли и извити плочки и чинии'),
  (22, 'Пневматика'),
  (23, 'Панели'),
  (24, 'Други'),
  (25, 'Technic кормилно управление, окачване и двигател'),
  (26, 'Специални Technic части'),
  (27, 'Аксесоари за минифигурки'),
  (28, 'Животни и същества'),
  (29, 'Колела и гуми'),
  (30, 'Тръби и маркучи'),
  (31, 'Въжета, ластици и макари'),
  (32, 'Пръчки, стълби и огради'),
  (33, 'Скали'),
  (34, 'Опори, греди и кранове'),
  (35, 'Транспорт – вода и въздух'),
  (36, 'Транспорт – суша'),
  (37, 'Извити тухлички'),
  (38, 'Знамена, банери и табели'),
  (39, 'Магнити и държачи'),
  (40, 'Technic панели'),
  (41, 'Големи сглобяеми фигури'),
  (42, 'Belville, Scala и Fabuland'),
  (43, 'Znap'),
  (44, 'Механични части'),
  (45, 'Електроника'),
  (46, 'Technic оси'),
  (47, 'Предни стъкла и фюзелажи'),
  (48, 'Clikits'),
  (49, 'Клиновидни плочки'),
  (50, 'Мащаб HO'),
  (51, 'Technic греди'),
  (52, 'Technic зъбни колела'),
  (53, 'Technic щифтове'),
  (54, 'Technic втулки'),
  (55, 'Специални Technic греди'),
  (56, 'Инструменти'),
  (57, 'Несглобяеми фигури (Duplo, Fabuland и др.)'),
  (58, 'Стикери'),
  (59, 'Глави за минифигурки'),
  (60, 'Торсове за минифигурки'),
  (61, 'Крака за минифигурки'),
  (62, 'Глави за мини кукли'),
  (63, 'Торсове за мини кукли'),
  (64, 'Крака за мини кукли'),
  (65, 'Шапки и прически за минифигурки'),
  (66, 'Modulex'),
  (67, 'Кръгли и извити гладки плочки'),
  (68, 'Снаряди и изстрелвачки'),
  (69, 'Енергийни ефекти'),
  (70, 'Поли и колани за минифигурки'),
  (71, 'Наметала и шалове за минифигурки'),
  (72, 'Аксесоари за шапки на минифигурки'),
  (73, 'Щитове, оръжия и инструменти за минифигурки'),
  (74, 'Аксесоари за животни и същества'),
  (75, 'Части от тела на животни и същества'),
  (76, 'Растения и дървета'),
  (77, 'Несистемни части'),
  (78, 'Химикалки и часовници')
) as v (id, name_bg)
where pc.id = v.id and pc.name_bg is null;

-- The storefront shows the Bulgarian category (otherwise unchanged from 20261015140000_set_names_bg.sql)
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

-- Sidebar / categories page names (otherwise unchanged from 20261019120000_listed_part_filter_counts.sql)
create or replace function public.listed_part_filter_counts()
returns table (kind text, id int, name text, rgb text, condition public.item_condition, listing_count bigint, sample_img_url text)
language sql
stable
set search_path = ''
as $$
  select 'category', pc.id, coalesce(pc.name_bg, pc.name), null::text, l.condition, count(*), min(coalesce(pcol.img_url, p.img_url))
  from public.listings l
  join public.parts p on p.part_num = l.part_num
  join public.part_categories pc on pc.id = p.part_cat_id
  left join public.part_colors pcol on pcol.part_num = l.part_num and pcol.color_id = l.color_id
  where l.item_type = 'part' and l.is_published and l.stock > 0
  group by pc.id, l.condition
  union all
  select 'color', c.id, c.name, c.rgb, l.condition, count(*), null::text
  from public.listings l
  join public.colors c on c.id = l.color_id
  where l.item_type = 'part' and l.is_published and l.stock > 0
  group by c.id, c.name, c.rgb, l.condition;
$$;
