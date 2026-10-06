-- Wishlist. A favourite is the catalog item, not a listing: used listings are single copies,
-- so a favourite has to survive the listing selling out and light up again when it is restocked.
--   item_key: 'set:<set_num>' | 'minifig:<fig_num>' | 'part:<part_num>:<color_id>'
--   name / image_url: snapshot for showing the favourite while nothing is in stock
-- Guests keep favourites in localStorage; they are merged into this table on login.
create table public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_key   text not null check (item_key ~ '^(set|minifig|part):.+'),
  name       text not null,
  image_url  text,
  created_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

alter table public.favorites enable row level security;

create policy "own favorites" on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.favorites to authenticated;
