-- Live stock: broadcast listing updates over Supabase Realtime, so a product page / card / cart
-- open in another browser sees "sold out" the moment the last copy is ordered (place_order
-- decrements listings.stock). Realtime applies the table's RLS per subscriber, so visitors only
-- receive rows they may read (published listings).
alter publication supabase_realtime add table public.listings;
