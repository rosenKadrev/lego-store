-- Admin bell: new orders the admin hasn't looked at yet.
--   * profiles.orders_seen_at — orders created after it count as unseen; set when the admin opens the bell
--     (or the orders page). Stored in the database so every device agrees.
--   * orders in the Realtime publication — the bell gets new orders live. Realtime applies the table's RLS
--     per subscriber, so a customer would only ever receive their own orders (and only the admin subscribes).

alter table public.profiles add column orders_seen_at timestamptz;

alter publication supabase_realtime add table public.orders;
