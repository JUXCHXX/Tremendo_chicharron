-- Corrige la ambigüedad entre la variable PL/pgSQL v_item y el alias SQL
-- usado al insertar los nuevos items de un pedido.

create or replace function public.editar_pedido_con_items(
  p_pedido_id uuid,
  p_items jsonb,
  p_valor_domicilio numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_total numeric;
  v_es_staff boolean;
  v_es_cliente boolean;
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  v_es_staff := public.es_staff(auth.uid());
  v_es_cliente := (
    v_pedido.cliente_telefono =
      current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
    and now() < v_pedido.editable_hasta
  );
  if not v_es_staff and not v_es_cliente then
    raise exception 'No tienes permiso para editar este pedido';
  end if;

  if v_pedido.estado in ('en_cocina','en_preparacion','en_camino','entregado','cancelado') then
    raise exception 'El pedido ya está en cocina o fue finalizado y no puede editarse';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items debe ser un arreglo JSON';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'cantidad') is null
       or (v_item->>'precio_unitario') is null
       or (v_item->>'nombre') is null then
      raise exception 'Cada item debe tener nombre, cantidad y precio_unitario';
    end if;
    v_subtotal := v_subtotal + (v_item->>'cantidad')::numeric * (v_item->>'precio_unitario')::numeric;
  end loop;

  v_total := v_subtotal + coalesce(p_valor_domicilio, v_pedido.valor_domicilio) + v_pedido.propina;

  update public.pedidos
     set subtotal = v_subtotal,
         total = v_total,
         valor_domicilio = coalesce(p_valor_domicilio, v_pedido.valor_domicilio),
         version = v_pedido.version + 1
   where id = p_pedido_id;

  delete from public.pedido_items where pedido_id = p_pedido_id;

  insert into public.pedido_items
    (pedido_id, producto_id, nombre_producto, cantidad, variante_personas, combo, notas, precio_unitario)
  select
    p_pedido_id,
    nullif(elem->>'producto_id', '')::uuid,
    elem->>'nombre',
    (elem->>'cantidad')::int,
    nullif(elem->>'variante_personas', '')::int,
    coalesce((elem->>'combo')::boolean, false),
    coalesce(elem->>'notas', ''),
    (elem->>'precio_unitario')::numeric
  from jsonb_array_elements(p_items) as elem;

  return jsonb_build_object(
    'ok', true,
    'subtotal', v_subtotal,
    'valor_domicilio', coalesce(p_valor_domicilio, v_pedido.valor_domicilio),
    'total', v_total,
    'version', v_pedido.version + 1
  );
end $$;

grant execute on function public.editar_pedido_con_items(uuid, jsonb, numeric) to anon, authenticated;