-- Price per piece by part category, used by Admin → "Части от сет" to price a whole set's inventory at once
-- (a set has 300+ different parts but only ~20 categories). The admin adjusts them on that page; whatever
-- was used last is saved here. Printed parts get a multiplier on top (set on the page).
create table public.part_category_prices (
  part_cat_id int primary key references public.part_categories (id) on delete cascade,
  price       numeric(10, 2) not null check (price >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.part_category_prices enable row level security;
create policy "admin all" on public.part_category_prices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Starting values (new parts, EUR) — rough market levels, meant to be tuned
insert into public.part_category_prices (part_cat_id, price)
select v.id, v.price
from (values
  (1, 2.00),  -- Baseplates
  (3, 0.10),  -- Bricks Sloped
  (5, 0.12),  -- Bricks Special
  (6, 0.15),  -- Bricks Wedged
  (7, 0.40),  -- Containers
  (8, 0.15),  -- Technic Bricks
  (9, 0.08),  -- Plates Special
  (11, 0.08), -- Bricks
  (12, 0.08), -- Technic Connectors
  (13, 4.00), -- Minifigs
  (14, 0.05), -- Plates
  (15, 0.08), -- Tiles Special
  (16, 0.30), -- Windows and Doors
  (18, 0.12), -- Hinges, Arms and Turntables
  (19, 0.06), -- Tiles
  (20, 0.08), -- Bricks Round and Cones
  (21, 0.06), -- Plates Round Curved and Dishes
  (22, 1.00), -- Pneumatics
  (23, 0.20), -- Panels
  (24, 0.10), -- Other
  (25, 0.40), -- Technic Steering, Suspension and Engine
  (26, 0.25), -- Technic Special
  (27, 0.10), -- Minifig Accessories
  (28, 0.80), -- Animals / Creatures
  (29, 0.25), -- Wheels and Tyres
  (30, 0.10), -- Tubes and Hoses
  (31, 0.20), -- String, Bands and Reels
  (32, 0.06), -- Bars, Ladders and Fences
  (33, 0.30), -- Rock
  (34, 0.30), -- Supports, Girders and Cranes
  (35, 0.50), -- Transportation - Sea and Air
  (36, 0.50), -- Transportation - Land
  (37, 0.10), -- Bricks Curved
  (38, 0.30), -- Flags, Banners and Signs
  (39, 0.30), -- Magnets and Holders
  (40, 0.40), -- Technic Panels
  (45, 3.00), -- Electronics
  (46, 0.05), -- Technic Axles
  (47, 0.40), -- Windscreens and Fuselage
  (49, 0.10), -- Plates Wedged
  (51, 0.12), -- Technic Beams
  (52, 0.15), -- Technic Gears
  (53, 0.04), -- Technic Pins
  (54, 0.04), -- Technic Bushes
  (55, 0.20), -- Technic Beams Special
  (58, 0.50), -- Stickers
  (59, 0.40), -- Minifig Heads
  (60, 1.00), -- Minifig Upper Body
  (61, 0.60), -- Minifig Lower Body
  (65, 0.40), -- Minifig Headwear
  (67, 0.07), -- Tiles Round and Curved
  (68, 0.15), -- Projectiles / Launchers
  (69, 0.10), -- Energy Effects
  (70, 0.20), -- Minifig Hipwear
  (71, 0.20), -- Minifig Neckwear
  (72, 0.15), -- Minifig Headwear Accessories
  (73, 0.15), -- Minifig Shields, Weapons, & Tools
  (74, 0.15), -- Animal / Creature Accessories
  (75, 0.30), -- Animal / Creature Body Parts
  (76, 0.08)  -- Plants & Trees
) as v (id, price)
join public.part_categories c on c.id = v.id
on conflict do nothing;
