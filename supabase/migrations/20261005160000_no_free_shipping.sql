-- No free-shipping threshold: courier delivery is always paid, pickup is free.
-- NULL threshold = disabled (place_order's "subtotal >= threshold" is then never true).
alter table public.shop_settings
  alter column free_shipping_threshold drop not null,
  alter column free_shipping_threshold set default null;
update public.shop_settings set free_shipping_threshold = null;
