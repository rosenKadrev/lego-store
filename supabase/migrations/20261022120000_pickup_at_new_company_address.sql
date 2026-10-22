-- The company moved to „РОСЕН МИЛЧЕВ КЪДРЕВ“ ЕТ; pickup (and returns) follow its address
-- (SHOP_COMPANY.address in core/models.ts), written the way customers find it on the map
update public.shop_settings
   set pickup_address = 'гр. София, жк. Дружба-2, бл. 408, вх. А, ет. 6, ап. 18';
