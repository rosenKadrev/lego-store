-- LOCAL DEV ONLY: demo listings so the storefront has something to show.
-- Run after the catalog import:
--   docker exec -i supabase_db_lego-store psql -U postgres < scripts/seed-demo-listings.sql

-- Wipes ALL listings and orders (local only!)
delete from public.order_items; delete from public.order_status_history; delete from public.orders;
delete from public.listings;

-- New sets: recent big sets from a few popular themes
insert into public.listings (item_type, set_num, condition, price, compare_at_price, stock, is_published)
select 'set', s.set_num, 'new',
       round((20 + s.num_parts * 0.11)::numeric, 2) - 0.01,
       case when row_number() over () % 4 = 0 then round((30 + s.num_parts * 0.14)::numeric, 2) - 0.01 end,
       1 + (row_number() over () % 6)::int,
       true
from public.sets s
where s.year >= 2023 and s.num_parts between 150 and 4000 and s.img_url is not null
  and s.theme_id in (select id from public.themes where name in ('Star Wars', 'Technic', 'Icons', 'City', 'Ninjago', 'Harry Potter', 'Friends', 'Marvel', 'Creator Expert'))
order by s.num_parts desc
limit 60;

-- Used sets: older classics, one piece each
insert into public.listings (item_type, set_num, condition, price, stock, is_published,
                             has_box, has_instructions, is_complete, minifigs_complete, condition_notes)
select 'set', s.set_num, 'used',
       round((15 + s.num_parts * 0.07)::numeric, 2) - 0.01, 1, true,
       (row_number() over () % 2 = 0), true, (row_number() over () % 5 <> 0), true,
       'Сглобяван веднъж, пазен на рафт.'
from public.sets s
where s.year between 2005 and 2018 and s.num_parts between 200 and 2500 and s.img_url is not null
  and s.theme_id in (select id from public.themes where name in ('Star Wars', 'Technic', 'City', 'Creator', 'Harry Potter', 'Castle'))
order by s.num_parts desc
limit 30;

-- Minifigs
insert into public.listings (item_type, fig_num, condition, price, stock, is_published)
select 'minifig', m.fig_num, (case when row_number() over () % 3 = 0 then 'used' else 'new' end)::public.item_condition,
       round((4 + m.num_parts * 0.9)::numeric, 2) - 0.01, 1, true
from public.minifigs m
join public.set_minifigs sm on sm.fig_num = m.fig_num
join public.sets s on s.set_num = sm.set_num and s.year >= 2022
where m.img_url is not null and m.name ilike any (array['%Darth Vader%', '%Luke%', '%Harry Potter%', '%Iron Man%', '%Batman%', '%Stormtrooper%'])
group by m.fig_num, m.num_parts
limit 20;

update public.listings set stock = 1 where condition = 'used';

select condition, item_type, count(*) from public.listings group by 1, 2 order by 1, 2;
