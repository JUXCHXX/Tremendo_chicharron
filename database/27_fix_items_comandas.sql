-- ==========================================================================
-- TREMENDO CHICHARRÓN — 27. ITEMS OBLIGATORIOS EN COMANDAS Y FACTURAS
-- --------------------------------------------------------------------------
-- Los pedidos se insertan antes que sus líneas. La función anterior podía
-- abortar por un producto_id legacy que no era UUID y el frontend aceptaba la
-- cuenta aunque quedara con cero items.
-- Ejecutar después de las migraciones 18 y 26.
-- ==========================================================================

create or replace function public.registrar_items_pedido(
  p_pedido_id uuid,
  p_telefono text,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.estado_pedido;
  v_telefono text;
begin
  select estado, cliente_telefono into v_estado, v_telefono
    from public.pedidos where id = p_pedido_id;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_telefono <> p_telefono then raise exception 'El teléfono no corresponde al pedido'; end if;
  if v_estado not in ('pendiente_confirmacion_cajera', 'pendiente_pago', 'pago_confirmado') then
    raise exception 'El pedido ya no permite modificar sus productos';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido debe tener al menos un producto';
  end if;

  delete from public.pedido_items where pedido_id = p_pedido_id;
  insert into public.pedido_items (
    pedido_id, producto_id, nombre_producto, cantidad,
    variante_personas, combo, notas, precio_unitario
  )
  select
    p_pedido_id,
    case when item->>'producto_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (item->>'producto_id')::uuid else null end,
    item->>'nombre', (item->>'cantidad')::integer,
    nullif(item->>'variante_personas', '')::integer,
    coalesce((item->>'combo')::boolean, false), coalesce(item->>'notas', ''),
    (item->>'precio_unitario')::numeric
  from jsonb_array_elements(p_items) item;

  return (select count(*)::integer from public.pedido_items where pedido_id = p_pedido_id);
end;
$$;

revoke all on function public.registrar_items_pedido(uuid, text, jsonb) from public;
grant execute on function public.registrar_items_pedido(uuid, text, jsonb) to anon, authenticated;
