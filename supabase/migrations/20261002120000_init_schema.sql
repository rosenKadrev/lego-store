-- =====================================================================
-- LEGO store: initial schema
--   * Catalog (imported from Rebrickable): themes, sets, minifigs, set_minifigs
--   * Store: profiles, listings (new/used sets and minifigs), listing_images
--   * Orders: cash on delivery, stock reserved atomically in place_order()
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Catalog (read-only for clients, written by the import script)
-- ---------------------------------------------------------------------

create table public.themes (
  id        int primary key,
  name      text not null,
  parent_id int references public.themes (id)
);
create index themes_parent_id_idx on public.themes (parent_id);

create table public.sets (
  set_num   text primary key,             -- e.g. '75192-1'
  name      text not null,
  year      int  not null,
  theme_id  int  not null references public.themes (id),
  num_parts int  not null default 0,
  img_url   text
);
create index sets_theme_id_idx on public.sets (theme_id);
create index sets_name_trgm_idx on public.sets using gin (name extensions.gin_trgm_ops);
create index sets_set_num_trgm_idx on public.sets using gin (set_num extensions.gin_trgm_ops);

create table public.minifigs (
  fig_num   text primary key,             -- e.g. 'fig-000001'
  name      text not null,
  num_parts int  not null default 0,
  img_url   text
);
create index minifigs_name_trgm_idx on public.minifigs using gin (name extensions.gin_trgm_ops);

-- Flattened from Rebrickable inventories + inventory_minifigs (latest inventory version per set)
create table public.set_minifigs (
  set_num  text not null references public.sets (set_num) on delete cascade,
  fig_num  text not null references public.minifigs (fig_num) on delete cascade,
  quantity int  not null check (quantity > 0),
  primary key (set_num, fig_num)
);
create index set_minifigs_fig_num_idx on public.set_minifigs (fig_num);

-- ---------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------

create type public.user_role as enum ('customer', 'admin');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  phone      text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their name/phone but never their role.
-- Trusted roles (postgres in the SQL editor, service_role) are not restricted,
-- so the first admin can be promoted with a plain UPDATE.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('anon', 'authenticated')
     and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- Listings: what is actually for sale
--   new set/minifig  -> one listing, stock = N
--   used set/minifig -> one listing per physical item, stock 0..1, own photos
-- ---------------------------------------------------------------------

create type public.item_type as enum ('set', 'minifig');
create type public.item_condition as enum ('new', 'used');

create table public.listings (
  id                bigint generated always as identity primary key,
  item_type         public.item_type not null,
  set_num           text references public.sets (set_num),
  fig_num           text references public.minifigs (fig_num),
  condition         public.item_condition not null,
  price             numeric(10, 2) not null check (price >= 0),
  compare_at_price  numeric(10, 2) check (compare_at_price is null or compare_at_price > price),
  stock             int not null default 0 check (stock >= 0),
  -- used items only
  has_box           boolean,
  has_instructions  boolean,
  is_complete       boolean,
  minifigs_complete boolean,
  condition_notes   text,
  description       text,
  is_published      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint listings_item_ref check (
    (item_type = 'set'     and set_num is not null and fig_num is null) or
    (item_type = 'minifig' and fig_num is not null and set_num is null)
  ),
  constraint listings_used_single check (condition = 'new' or stock <= 1)
);
create index listings_set_num_idx on public.listings (set_num);
create index listings_fig_num_idx on public.listings (fig_num);
create index listings_browse_idx on public.listings (is_published, condition, item_type, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function public.touch_updated_at();

create table public.listing_images (
  id         bigint generated always as identity primary key,
  listing_id bigint not null references public.listings (id) on delete cascade,
  path       text not null,               -- path in the 'listing-images' storage bucket
  sort_order int  not null default 0
);
create index listing_images_listing_id_idx on public.listing_images (listing_id, sort_order);

-- Storefront view: listing + catalog data in one row
create view public.catalog_listings
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
  coalesce(l.set_num, l.fig_num)    as item_num,
  coalesce(s.name, m.name)          as name,
  coalesce(s.num_parts, m.num_parts) as num_parts,
  coalesce(s.img_url, m.img_url)    as catalog_img_url,
  s.year,
  s.theme_id,
  t.name                            as theme_name,
  (select li.path from public.listing_images li
    where li.listing_id = l.id order by li.sort_order, li.id limit 1) as cover_path
from public.listings l
left join public.sets s     on s.set_num = l.set_num
left join public.minifigs m on m.fig_num = l.fig_num
left join public.themes t   on t.id = s.theme_id;

-- Top-level themes that currently have published, in-stock listings (for navigation)
create or replace function public.listed_root_themes()
returns table (theme_id int, name text, listing_count bigint, sample_img_url text)
language sql
stable
set search_path = ''
as $$
  with recursive tree as (
    select t.id, t.id as root_id from public.themes t where t.parent_id is null
    union all
    select c.id, tree.root_id from public.themes c join tree on c.parent_id = tree.id
  ),
  listed as (
    select tree.root_id, s.img_url
    from public.listings l
    join public.sets s on s.set_num = l.set_num
    join tree on tree.id = s.theme_id
    where l.is_published and l.stock > 0
  )
  select r.id, r.name, count(*), min(listed.img_url)
  from listed
  join public.themes r on r.id = listed.root_id
  group by r.id, r.name
  order by count(*) desc, r.name;
$$;

-- ---------------------------------------------------------------------
-- Orders (cash on delivery)
-- ---------------------------------------------------------------------

create type public.order_status as enum (
  'new', 'confirmed', 'shipped', 'delivered', 'paid',
  'cancelled', 'refused', 'returned'
);
create type public.payment_method as enum ('cod');
create type public.delivery_type as enum ('office', 'address');
create type public.courier as enum ('econt', 'speedy');

create sequence public.order_number_seq start 1001;

create table public.orders (
  id              bigint generated always as identity primary key,
  number          text not null unique
                  default 'LS-' || nextval('public.order_number_seq')::text,
  user_id         uuid references auth.users (id) on delete set null,
  status          public.order_status not null default 'new',
  payment_method  public.payment_method not null default 'cod',
  customer_name   text not null,
  phone           text not null,
  email           text not null,
  delivery_type   public.delivery_type not null,
  courier         public.courier not null,
  office_code     text,
  address         text,
  city            text,
  note            text,
  subtotal        numeric(10, 2) not null,
  shipping_price  numeric(10, 2) not null,
  total           numeric(10, 2) not null,
  tracking_number text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint orders_delivery_target check (
    (delivery_type = 'office'  and office_code is not null) or
    (delivery_type = 'address' and address is not null and city is not null)
  )
);
create index orders_user_id_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (phone);

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references public.orders (id) on delete cascade,
  listing_id bigint not null references public.listings (id),
  name       text not null,               -- snapshot at order time
  item_num   text not null,
  condition  public.item_condition not null,
  unit_price numeric(10, 2) not null,
  quantity   int not null check (quantity > 0)
);
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_listing_id_idx on public.order_items (listing_id);

create table public.order_status_history (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  changed_by uuid references auth.users (id),
  note       text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_id_idx on public.order_status_history (order_id);

-- Shop settings (single row)
create table public.shop_settings (
  id                       boolean primary key default true check (id),
  shipping_price_office    numeric(10, 2) not null default 3.50,
  shipping_price_address   numeric(10, 2) not null default 5.50,
  free_shipping_threshold  numeric(10, 2) not null default 55.00
);
insert into public.shop_settings default values;

-- ---------------------------------------------------------------------
-- place_order: validates prices from DB and reserves stock atomically
--   p_items: [{ "listing_id": 1, "quantity": 2 }, ...]
-- ---------------------------------------------------------------------

create or replace function public.place_order(
  p_customer_name text,
  p_phone         text,
  p_email         text,
  p_delivery_type public.delivery_type,
  p_courier       public.courier,
  p_items         jsonb,
  p_office_code   text default null,
  p_address       text default null,
  p_city          text default null,
  p_note          text default null
)
returns table (order_id bigint, order_number text, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id bigint;
  v_number   text;
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2);
  v_settings public.shop_settings;
  v_item     record;
  v_listing  record;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_phone), '') = ''
     or coalesce(trim(p_email), '') = '' then
    raise exception 'Name, phone and email are required';
  end if;

  select * into v_settings from public.shop_settings;

  insert into public.orders (
    user_id, customer_name, phone, email, delivery_type, courier,
    office_code, address, city, note, subtotal, shipping_price, total
  ) values (
    (select auth.uid()), p_customer_name, p_phone, p_email, p_delivery_type, p_courier,
    p_office_code, p_address, p_city, p_note, 0, 0, 0
  )
  returning id, number into v_order_id, v_number;

  -- Sort by listing id so concurrent orders lock rows in the same order (no deadlocks)
  for v_item in
    select (e ->> 'listing_id')::bigint as listing_id, sum((e ->> 'quantity')::int) as quantity
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Invalid quantity for listing %', v_item.listing_id;
    end if;

    -- Conditional update = row lock + stock check in one step
    update public.listings l
       set stock = l.stock - v_item.quantity
     where l.id = v_item.listing_id
       and l.is_published
       and l.stock >= v_item.quantity
    returning l.id, l.price, l.condition, l.set_num, l.fig_num
      into v_listing;

    if not found then
      raise exception 'OUT_OF_STOCK:%', v_item.listing_id
        using errcode = 'P0001';
    end if;

    insert into public.order_items (order_id, listing_id, name, item_num, condition, unit_price, quantity)
    values (
      v_order_id,
      v_listing.id,
      coalesce((select s.name from public.sets s where s.set_num = v_listing.set_num),
               (select m.name from public.minifigs m where m.fig_num = v_listing.fig_num)),
      coalesce(v_listing.set_num, v_listing.fig_num),
      v_listing.condition,
      v_listing.price,
      v_item.quantity
    );

    v_subtotal := v_subtotal + v_listing.price * v_item.quantity;
  end loop;

  v_shipping := case
    when v_subtotal >= v_settings.free_shipping_threshold then 0
    when p_delivery_type = 'office' then v_settings.shipping_price_office
    else v_settings.shipping_price_address
  end;

  update public.orders
     set subtotal = v_subtotal, shipping_price = v_shipping, total = v_subtotal + v_shipping
   where id = v_order_id;

  insert into public.order_status_history (order_id, status, changed_by)
  values (v_order_id, 'new', (select auth.uid()));

  return query select v_order_id, v_number, v_subtotal + v_shipping;
end;
$$;

-- ---------------------------------------------------------------------
-- set_order_status (admin): returns stock when an order is cancelled/refused/returned
-- ---------------------------------------------------------------------

create or replace function public.set_order_status(
  p_order_id bigint,
  p_status   public.order_status,
  p_note     text default null,
  p_tracking_number text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.order_status;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select status into v_old from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_old = p_status then
    return;
  end if;

  -- Release stock once, when leaving an active state for a terminal "no sale" state
  if p_status in ('cancelled', 'refused', 'returned')
     and v_old not in ('cancelled', 'refused', 'returned') then
    update public.listings l
       set stock = l.stock + oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id and oi.listing_id = l.id;
  end if;

  update public.orders
     set status = p_status,
         tracking_number = coalesce(p_tracking_number, tracking_number)
   where id = p_order_id;

  insert into public.order_status_history (order_id, status, changed_by, note)
  values (p_order_id, p_status, (select auth.uid()), p_note);
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.themes               enable row level security;
alter table public.sets                 enable row level security;
alter table public.minifigs             enable row level security;
alter table public.set_minifigs         enable row level security;
alter table public.profiles             enable row level security;
alter table public.listings             enable row level security;
alter table public.listing_images       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.shop_settings        enable row level security;

-- Catalog: public read, admin write (bulk import uses the service role)
create policy "catalog read" on public.themes       for select using (true);
create policy "catalog read" on public.sets         for select using (true);
create policy "catalog read" on public.minifigs     for select using (true);
create policy "catalog read" on public.set_minifigs for select using (true);
create policy "admin write"  on public.themes       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.sets         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.minifigs     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write"  on public.set_minifigs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profiles
create policy "own profile read"   on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy "own profile update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- Listings: published are public, admin manages everything
create policy "published listings read" on public.listings for select
  using (is_published or public.is_admin());
create policy "admin write" on public.listings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "listing images read" on public.listing_images for select
  using (exists (select 1 from public.listings l
                 where l.id = listing_id and (l.is_published or public.is_admin())));
create policy "admin write" on public.listing_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Orders: customers read their own; all writes go through RPCs
create policy "own orders read" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "admin update" on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "own order items read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));

create policy "own order history read" on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and (o.user_id = (select auth.uid()) or public.is_admin())));

create policy "settings read" on public.shop_settings for select using (true);
create policy "admin write" on public.shop_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.themes, public.sets, public.minifigs, public.set_minifigs,
                public.listings, public.listing_images, public.catalog_listings,
                public.shop_settings
  to anon, authenticated;
grant insert, update, delete on public.themes, public.sets, public.minifigs, public.set_minifigs,
                                public.listings, public.listing_images
  to authenticated;
grant select, update on public.profiles, public.orders, public.shop_settings to authenticated;
grant select on public.order_items, public.order_status_history to authenticated;

revoke execute on function public.place_order from public;
grant execute on function public.place_order to anon, authenticated;
revoke execute on function public.set_order_status from public, anon;
grant execute on function public.set_order_status to authenticated;
grant execute on function public.is_admin to anon, authenticated;
grant execute on function public.listed_root_themes to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: public bucket for listing photos, admin uploads
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "listing images public read" on storage.objects for select
  using (bucket_id = 'listing-images');
create policy "listing images admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and public.is_admin());
create policy "listing images admin update" on storage.objects for update to authenticated
  using (bucket_id = 'listing-images' and public.is_admin());
create policy "listing images admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and public.is_admin());
