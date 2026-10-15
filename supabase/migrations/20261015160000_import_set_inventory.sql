-- Admin: create listings for a set's inventory in bulk (see the set-parts Edge Function) — loose parts
-- and the set's minifigs. A part + colour + condition (or minifig + condition) that already has a
-- listing gets the quantity added to its stock (its price stays); everything else becomes a new
-- listing, hidden until the admin publishes it.
create or replace function public.import_set_inventory(
  p_parts     jsonb,                    -- [{ "part_num": "3001", "color_id": 5, "quantity": 4, "price": 0.10 }]
  p_minifigs  jsonb,                    -- [{ "fig_num": "fig-012345", "quantity": 1, "price": 6.00 }]
  p_condition public.item_condition
)
returns table (created int, updated int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created int := 0;
  v_updated int := 0;
  v_item    record;
  v_id      bigint;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  for v_item in
    select e ->> 'part_num' as part_num,
           (e ->> 'color_id')::int as color_id,
           sum((e ->> 'quantity')::int) as quantity,
           max((e ->> 'price')::numeric) as price
    from jsonb_array_elements(coalesce(p_parts, '[]')) e
    group by 1, 2
  loop
    continue when v_item.quantity is null or v_item.quantity <= 0;
    if v_item.price is null or v_item.price < 0 then
      raise exception 'Invalid price for % / %', v_item.part_num, v_item.color_id;
    end if;

    select l.id into v_id
    from public.listings l
    where l.item_type = 'part' and l.part_num = v_item.part_num and l.color_id = v_item.color_id
      and l.condition = p_condition
    order by l.is_published desc, l.id
    limit 1
    for update;

    if found then
      update public.listings set stock = stock + v_item.quantity where id = v_id;
      v_updated := v_updated + 1;
    else
      insert into public.listings (item_type, part_num, color_id, condition, price, stock, is_published)
      values ('part', v_item.part_num, v_item.color_id, p_condition, round(v_item.price, 2), v_item.quantity, false);
      v_created := v_created + 1;
    end if;
  end loop;

  for v_item in
    select e ->> 'fig_num' as fig_num,
           sum((e ->> 'quantity')::int) as quantity,
           max((e ->> 'price')::numeric) as price
    from jsonb_array_elements(coalesce(p_minifigs, '[]')) e
    group by 1
  loop
    continue when v_item.quantity is null or v_item.quantity <= 0;
    if v_item.price is null or v_item.price < 0 then
      raise exception 'Invalid price for %', v_item.fig_num;
    end if;

    -- Used minifigs are single items (one listing each); only new ones are merged
    select l.id into v_id
    from public.listings l
    where l.item_type = 'minifig' and l.fig_num = v_item.fig_num and l.condition = p_condition
      and p_condition = 'new'
    order by l.is_published desc, l.id
    limit 1
    for update;

    if found then
      update public.listings set stock = stock + v_item.quantity where id = v_id;
      v_updated := v_updated + 1;
    elsif p_condition = 'new' then
      insert into public.listings (item_type, fig_num, condition, price, stock, is_published)
      values ('minifig', v_item.fig_num, p_condition, round(v_item.price, 2), v_item.quantity, false);
      v_created := v_created + 1;
    else
      insert into public.listings (item_type, fig_num, condition, price, stock, is_published)
      select 'minifig', v_item.fig_num, p_condition, round(v_item.price, 2), 1, false
      from generate_series(1, v_item.quantity);
      v_created := v_created + v_item.quantity;
    end if;
  end loop;

  return query select v_created, v_updated;
end;
$$;

revoke execute on function public.import_set_inventory from public, anon;
