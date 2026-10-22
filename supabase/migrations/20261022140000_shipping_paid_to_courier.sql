-- Shipping is paid by the customer straight to the courier (Еконт/Спиди "платец: получател"),
-- so the наложен платеж — and orders.total — is the products only. shipping_price stays on the
-- order so the customer still sees what the courier will charge.
create or replace function public.set_order_shipping(p_order_id bigint, p_shipping_price numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if p_shipping_price is null or p_shipping_price < 0 then
    raise exception 'Invalid shipping price';
  end if;

  update public.orders
     set shipping_price = round(p_shipping_price, 2)
   where id = p_order_id and delivery_type <> 'pickup';
  if not found then
    raise exception 'Order % not found or is a pickup order', p_order_id;
  end if;
end;
$$;
revoke execute on function public.set_order_shipping from public, anon;
grant execute on function public.set_order_shipping to authenticated;

update public.orders set total = subtotal where total <> subtotal;
