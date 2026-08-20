-- ============================================================================
-- TREMENDO CHICHARRÓN — 17. FIX RLS: VALORACIONES (INSERT BLOQUEADO)
-- ----------------------------------------------------------------------------
-- Problema reportado:
--   "new row violates row-level security policy for table 'valoraciones'"
--   El cliente califica un plato entregado y el INSERT es rechazado.
--
-- Causa raíz:
--   La política valoraciones_insert_publico (migración 11) hace subqueries
--   sobre `pedidos` y `pedido_items` dentro del `with check`. Esas tablas
--   tienen RLS habilitado y el rol anon NO puede hacer SELECT sin el header
--   x-cliente-telefono → los subqueries devuelven 0 filas → el with check
--   falla → el INSERT se rechaza (mismo patrón de RLS recursivo ya corregido
--   en pedidos/clientes).
--
-- Solución (consistente con el resto del sistema):
--   Función SECURITY DEFINER `puede_valorar_pedido()` que ejecuta con
--   privilegios del owner (bypassa RLS) y valida:
--     1. El pedido existe, está 'entregado' y el teléfono coincide.
--     2. El producto realmente está en ese pedido.
--     3. No existe ya una valoración para ese pedido+producto.
--   La política INSERT usa esta función en lugar de subqueries directas.
-- ============================================================================

-- 1) Función de validación SECURITY DEFINER (bypassa RLS de pedidos/items).
create or replace function public.puede_valorar_pedido(
  p_pedido_id uuid,
  p_producto_id uuid,
  p_telefono text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- 1) El pedido existe, está entregado y el teléfono coincide.
  if not exists (
    select 1
      from public.pedidos p
     where p.id = p_pedido_id
       and p.estado = 'entregado'
       and p.cliente_telefono = p_telefono
  ) then
    return false;
  end if;

  -- 2) El producto realmente está en ese pedido.
  if not exists (
    select 1
      from public.pedido_items pi
     where pi.pedido_id = p_pedido_id
       and pi.producto_id = p_producto_id
  ) then
    return false;
  end if;

  -- 3) No existe ya una valoración para ese pedido+producto.
  if exists (
    select 1
      from public.valoraciones v
     where v.pedido_id = p_pedido_id
       and v.producto_id = p_producto_id
  ) then
    return false;
  end if;

  return true;
end $$;

grant execute on function public.puede_valorar_pedido(uuid, uuid, text) to anon, authenticated;

-- 2) Recrear la política INSERT usando la función (sin subqueries RLS-bloqueadas).
drop policy if exists valoraciones_insert_publico on public.valoraciones;
create policy valoraciones_insert_publico on public.valoraciones
  for insert to anon, authenticated
  with check (
    public.puede_valorar_pedido(pedido_id, producto_id, cliente_telefono)
  );

-- 3) La lectura pública ya existe (valoraciones_select_publico, migración 11).
--    Se mantiene tal cual: cualquiera puede ver las valoraciones en el menú.