-- ============================================================================
-- TREMENDO CHICHARRÓN — 25. FIX DEFINITIVO DOMICILIARIOS + SEGUIMIENTO
-- ----------------------------------------------------------------------------
-- Migración consolidada posterior a los esquemas 1–24.
--
-- Esta migración deja una sola ruta válida para:
--   1) autoasignar pedidos de forma atómica;
--   2) actualizar estados después de la asignación;
--   3) eliminar restos del intento antiguo de domiciliarios.
--
-- El seguimiento del cliente se resuelve exclusivamente por polling mediante
-- la RPC consultar_pedido_por_comanda_y_telefono(). No se intenta habilitar
-- Realtime anónimo contra pedidos_select_anon, porque esa política exige un
-- header que la conexión Realtime no puede enviar.
-- ============================================================================

-- ── 1) LIMPIEZA DE RESTOS DEL INTENTO 17 ────────────────────────────────────
-- Estos objetos pertenecían al módulo antiguo y no son usados por el módulo
-- definitivo (19–24). La tabla domiciliarios NO se elimina: es la tabla
-- definitiva que conserva los perfiles actualmente registrados.
drop function if exists public.asignar_domiciliario(uuid, uuid);
drop view if exists public.vista_pedidos_domiciliario;
drop view if exists public.propinas_por_dia;
drop policy if exists "Domiciliarios publico puede leer" on public.domiciliarios;
drop policy if exists "Solo admin puede modificar domiciliarios" on public.domiciliarios;

-- usuarios_autorizados nunca fue creado por ninguno de los scripts 1–24;
-- por eso no se elimina una tabla ajena al esquema consolidado.

-- ── 2) FUNCIÓN ÚNICA Y DEFINITIVA DE AUTOASIGNACIÓN ─────────────────────────
drop function if exists public.asignar_pedido_a_domiciliario(text);

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
  v_domiciliario_asignado uuid;
begin
  select d.id
    into v_domiciliario_id
    from public.domiciliarios d
   where d.user_id = auth.uid()
     and d.activo = true
   limit 1;

  if v_domiciliario_id is null then
    raise exception 'No autorizado: no eres un domiciliario activo';
  end if;

  select p.id, p.estado, p.domiciliario_id
    into v_pedido_id, v_estado_actual, v_domiciliario_asignado
    from public.pedidos p
   where p.numero_comanda = p_numero_comanda
   limit 1;

  if v_pedido_id is null then
    raise exception 'No existe ningún pedido con la comanda %', p_numero_comanda;
  end if;

  if v_domiciliario_asignado is not null then
    raise exception 'El pedido % ya fue asignado a otro domiciliario', p_numero_comanda;
  end if;

  if v_estado_actual not in ('pago_confirmado', 'en_cocina', 'en_preparacion') then
    raise exception 'El pedido % no es asignable: su estado actual es %',
      p_numero_comanda, v_estado_actual;
  end if;

  -- La condición NULL hace que dos domiciliarios no puedan tomar la misma
  -- comanda. La condición de estado también protege contra carreras con Caja.
  update public.pedidos p
     set domiciliario_id = v_domiciliario_id,
         asignado_en = now()
   where p.id = v_pedido_id
     and p.domiciliario_id is null
     and p.estado in ('pago_confirmado', 'en_cocina', 'en_preparacion');

  if not found then
    -- Releer para distinguir una carrera de asignación de un cambio de estado.
    select p.domiciliario_id, p.estado
      into v_domiciliario_asignado, v_estado_actual
      from public.pedidos p
     where p.id = v_pedido_id;

    if v_domiciliario_asignado is not null then
      raise exception 'El pedido % fue asignado por otro domiciliario', p_numero_comanda;
    end if;

    raise exception 'El pedido % dejó de ser asignable: su estado actual es %',
      p_numero_comanda, v_estado_actual;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pedido_id', v_pedido_id,
    'domiciliario_id', v_domiciliario_id
  );
end;
$$;

revoke all on function public.asignar_pedido_a_domiciliario(text) from public;
grant execute on function public.asignar_pedido_a_domiciliario(text) to authenticated;

-- ── 3) RPC SEGURA PARA POLLING DE TODOS LOS PEDIDOS DEL CLIENTE ─────────────
-- Mi Chicharronera necesita listar varias comandas. Se conserva la RPC
-- existente de consulta individual y se añade esta variante para que el
-- polling no dependa de un SELECT anidado sujeto a varias políticas RLS.
create or replace function public.consultar_pedidos_por_telefono(p_telefono text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'pedido', to_jsonb(p),
        'items', coalesce(
          (
            select jsonb_agg(to_jsonb(i) order by i.id)
              from public.pedido_items i
             where i.pedido_id = p.id
          ),
          '[]'::jsonb
        )
      )
      order by p.creado_en desc
    ),
    '[]'::jsonb
  )
    from public.pedidos p
   where p.cliente_telefono = p_telefono;
$$;

revoke all on function public.consultar_pedidos_por_telefono(text) from public;
grant execute on function public.consultar_pedidos_por_telefono(text) to anon, authenticated;

-- ── 4) RLS STAFF: ACTUALIZACIÓN DE PEDIDOS ───────────────────────────────────
-- El estado puede avanzar desde Caja en cualquier transición válida. La
-- protección de que el contenido no cambie después de cocina permanece en los
-- triggers de edición del esquema 18; no debe duplicarse aquí mediante una
-- función que vuelva a leer pedidos dentro de la política.
drop policy if exists pedidos_update_staff on public.pedidos;
create policy pedidos_update_staff
on public.pedidos
for update
to authenticated
using (public.es_staff(auth.uid()))
with check (public.es_staff(auth.uid()));

-- ── 5) RLS SOLO PARA ESTADOS POSTERIORES A LA ASIGNACIÓN ────────────────────
drop policy if exists pedidos_update_domiciliario on public.pedidos;
create policy pedidos_update_domiciliario
on public.pedidos
for update
to authenticated
using (
  domiciliario_id in (
    select d.id
      from public.domiciliarios d
     where d.user_id = auth.uid()
       and d.activo = true
  )
)
with check (
  domiciliario_id in (
    select d.id
      from public.domiciliarios d
     where d.user_id = auth.uid()
       and d.activo = true
  )
  and estado in ('en_camino', 'entregado')
);

-- ── 6) ELIMINAR VISTA DE SEGUIMIENTO NO UTILIZADA ───────────────────────────
drop view if exists public.pedidos_seguimiento;
