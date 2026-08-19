-- ============================================================================
-- TREMENDO CHICHARRÓN — 16. FIX: BOTÓN "CONFIRMAR PEDIDO" EN PANEL DE CAJA
-- ----------------------------------------------------------------------------
-- Problema reportado:
--   Al presionar "Confirmar pedido" (pendiente_confirmacion_cajera → pendiente_pago)
--   en el Panel de Caja, el pedido NO se movía de columna. El UPDATE de Supabase
--   podía ser rechazado por RLS o fallar sin feedback visible.
--
-- Solución:
--   1. RPC pública `actualizar_estado_pedido_staff()` con SECURITY DEFINER:
--      verifica que el usuario autenticado sea staff (es_staff) y ejecuta el
--      UPDATE con privilegios del owner, SIN depender de la política RLS de la
--      tabla. El cajero siempre puede confirmar/mover su flujo.
--   2. RPC `actualizar_domicilio_pedido_staff()` para el mismo propósito con el
--      valor del domicilio (la cajera también lo edita).
-- ============================================================================

-- 1) RPC para cambiar estado de un pedido (solo staff autenticado).
create or replace function public.actualizar_estado_pedido_staff(
  p_pedido_id uuid,
  p_estado public.estado_pedido
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := nullif(auth.uid()::text, '')::uuid;
begin
  if v_user_id is null or not public.es_staff(v_user_id) then
    raise exception 'No autorizado: requiero rol de staff (caja o dueño)';
  end if;

  update public.pedidos
     set estado = p_estado
   where id = p_pedido_id;

  return found;
end $$;

grant execute on function public.actualizar_estado_pedido_staff(uuid, public.estado_pedido) to authenticated;
grant execute on function public.actualizar_estado_pedido_staff(uuid, public.estado_pedido) to service_role;
revoke execute on function public.actualizar_estado_pedido_staff(uuid, public.estado_pedido) from anon;

-- 2) RPC para actualizar domicilio + total (cajera).
create or replace function public.actualizar_domicilio_pedido_staff(
  p_pedido_id uuid,
  p_valor_domicilio numeric,
  p_total_override numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := nullif(auth.uid()::text, '')::uuid;
  v_pedido record;
begin
  if v_user_id is null or not public.es_staff(v_user_id) then
    raise exception 'No autorizado: el staff (caja/dueno) puede administrar pedidos';
  end if;

  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido no encontrado: %', p_pedido_id;
  end if;

  update public.pedidos
     set valor_domicilio = p_valor_domicilio,
         total = coalesce(p_total_override, v_pedido.total - v_pedido.valor_domicilio + p_valor_domicilio)
   where id = p_pedido_id;

  return true;
end $$;

grant execute on function public.actualizar_domicilio_pedido_staff(uuid, numeric, numeric) to authenticated;
grant execute on function public.actualizar_domicilio_pedido_staff(uuid, numeric, numeric) to service_role;
revoke execute on function public.actualizar_domicilio_pedido_staff(uuid, numeric, numeric) from anon;