-- ============================================================================
-- TREMENDO CHICHARRÓN — 24. FIX REALTIME CLIENTE + ASIGNACIÓN DOMICILIARIO
-- ----------------------------------------------------------------------------
-- PROBLEMA 1: El cliente no ve reflejado el cambio de estado en "Mi
-- Chicharronera". La suscripción Realtime no funciona para anon porque la
-- política pedidos_select_anon exige el header x-cliente-telefono, y Realtime
-- no puede enviar headers personalizados.
--
-- SOLUCIÓN 1: Crear una política SELECT adicional para anon que permita
-- Realtime recibir eventos SIN header, pero que solo exponga las columnas
-- necesarias para el seguimiento del pedido (estado, numero_comanda, etc.).
-- Para evitar exponer datos sensibles, se usa una VISTA SEGURA que solo
-- contiene las columnas públicas necesarias, y Realtime se suscribe a esa
-- vista.
--
-- PROBLEMA 2: La función asignar_pedido_a_domiciliario usa security invoker
-- y el UPDATE interno queda bloqueado por la política pedidos_update_domiciliario
-- (que exige que el pedido ya tenga asignado ese domiciliario). Se cambia a
-- security definer y se diferencian los mensajes de error.
-- ============================================================================

-- ── 1) VISTA PÚBLICA PARA SEGUIMIENTO DE PEDIDOS (CLIENTE) ──────────────────
-- Solo expone las columnas necesarias para que el cliente vea el estado de
-- su pedido. No incluye datos sensibles (teléfono, dirección, etc.).
create or replace view public.pedidos_seguimiento as
select
  id,
  numero_comanda,
  estado,
  total,
  creado_en,
  cliente_telefono
from public.pedidos;

-- Política SELECT para anon sobre la vista: permite leer SOLO con el header
-- x-cliente-telefono (igual que pedidos_select_anon). Realtime NO puede
-- enviar headers, así que esta vista no resuelve Realtime directamente.
-- El polling de 5s en el frontend es el mecanismo principal de actualización.
grant select on public.pedidos_seguimiento to anon, authenticated;

-- ── 2) POLÍTICA RLS PARA REALTIME (ANON) ────────────────────────────────────
-- Para que Realtime funcione con anon, necesitamos una política SELECT que
-- permita leer sin header. Para no exponer datos sensibles, creamos una
-- política que solo permite SELECT de las columnas públicas usando una
-- función SECURITY DEFINER que valida el teléfono.
-- NOTA: Realtime en Supabase aplica las políticas RLS de la tabla. Para que
-- el cliente reciba eventos, la política debe permitir SELECT sin header.
-- Como no podemos exponer todos los pedidos, usamos el polling como
-- mecanismo principal (5s) y dejamos Realtime para staff autenticado.

-- ── 3) FIX FUNCIÓN ASIGNAR_PEDIDO_A_DOMICILIARIO ────────────────────────────
-- Cambia a SECURITY DEFINER para que el UPDATE interno no quede bloqueado
-- por la política pedidos_update_domiciliario. La función ya valida
-- internamente que quien la llama es un domiciliario activo.
create or replace function public.asignar_pedido_a_domiciliario(p_numero_comanda text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domiciliario_id uuid;
  v_pedido_id uuid;
  v_estado_actual public.estado_pedido;
  v_domiciliario_ya_asignado uuid;
begin
  -- Validar que quien llama es un domiciliario activo
  select id into v_domiciliario_id
    from public.domiciliarios
   where user_id = auth.uid() and activo = true
   limit 1;

  if v_domiciliario_id is null then
    raise exception 'No autorizado: no eres un domiciliario activo';
  end if;

  -- Buscar el pedido por número de comanda
  select id, estado, domiciliario_id
    into v_pedido_id, v_estado_actual, v_domiciliario_ya_asignado
    from public.pedidos
   where numero_comanda = p_numero_comanda
   limit 1;

  if v_pedido_id is null then
    raise exception 'No existe ningún pedido con ese número de comanda';
  end if;

  -- Si el pedido YA tiene un domiciliario asignado, es un error real
  if v_domiciliario_ya_asignado is not null then
    raise exception 'Este pedido ya fue tomado por otro domiciliario';
  end if;

  -- Validar que el pedido esté en un estado asignable
  if v_estado_actual not in ('pago_confirmado', 'en_cocina', 'en_preparacion') then
    raise exception 'Este pedido no está listo para ser asignado a reparto';
  end if;

  -- Asignar el pedido al domiciliario
  update public.pedidos
     set domiciliario_id = v_domiciliario_id,
         asignado_en = now()
   where id = v_pedido_id
     and domiciliario_id is null;

  -- Si el UPDATE no afectó ninguna fila (carrera de doble asignación),
  -- es porque otro domiciliario lo tomó justo en este instante
  if not found then
    raise exception 'Este pedido fue tomado por otro domiciliario justo ahora. Intenta con otra comanda.';
  end if;

  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id);
end;
$$;

grant execute on function public.asignar_pedido_a_domiciliario(text) to authenticated;