-- Pickup (and returns) happen at the company's address (SHOP_COMPANY.address in core/models.ts),
-- written the way customers find it on the map
update public.shop_settings
   set pickup_address = 'гр. София, жк. Дружба-2, бл. 410, вх. Б, ет. 1, ап. 33';
