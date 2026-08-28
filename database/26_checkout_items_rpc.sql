-- ==========================================================================
-- TREMENDO CHICHARRÓN — 26. GUARDADO SEGURO DE ITEMS EN CHECKOUT
-- --------------------------------------------------------------------------
-- Evita que el checkout anónimo dependa de headers personalizados para
-- insertar pedido_items desde navegadores móviles. La operación es
-- idempotente: si el cliente reintenta después de perder la respuesta, se
-- reemplazan las líneas del mismo pedido en lugar de duplicarlas.
-- ===========================================================================

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
  v_total integer;
begin
  select estado, cliente_telefono
    into v_estado, v_telefono
    from public.pedidos
   where id = p_pedido_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;
  if v_telefono <> p_telefono then
    raise exception 'El teléfono no corresponde al pedido';
  end if;
  if v_estado not in ('pendiente_confirmacion_cajera', 'pendiente_pago', 'pago_confirmado') then
    raise exception 'El pedido ya no permite modificar sus productos';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los productos deben enviarse como una lista';
  end if;

  delete from public.pedido_items where pedido_id = p_pedido_id;

  insert into public.pedido_items (
    pedido_id, producto_id, nombre_producto, cantidad,
    variante_personas, combo, notas, precio_unitario
  )
  select
    p_pedido_id,
    nullif(item->>'producto_id', '')::uuid,
    item->>'nombre',
    (item->>'cantidad')::integer,
    nullif(item->>'variante_personas', '')::integer,
    coalesce((item->>'combo')::boolean, false),
    coalesce(item->>'notas', ''),
    (item->>'precio_unitario')::numeric
  from jsonb_array_elements(p_items) item;

  select count(*)::integer into v_total
    from public.pedido_items
   where pedido_id = p_pedido_id;
  return v_total;
end;
$$;

revoke all on function public.registrar_items_pedido(uuid, text, jsonb) from public;
grant execute on function public.registrar_items_pedido(uuid, text, jsonb) to anon, authenticated;
