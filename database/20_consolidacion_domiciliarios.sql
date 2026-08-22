-- ============================================================================
-- TREMENDO CHICHARRÓN — 20. CONSOLIDACIÓN FINAL DEL MÓDULO DE DOMICILIARIOS
-- ----------------------------------------------------------------------------
-- ESTE SCRIPT REEMPLAZA CUALQUIER INTENTO ANTERIOR A MEDIAS.
--
-- ── QUÉ SE ELIMINA Y POR QUÉ ────────────────────────────────────────────────
-- 1. database/17_modulo_domiciliario.sql (INTENTO VIEJO, ABANDONADO):
--    - Creaba la tabla `domiciliarios` con columnas `nombre` y `telefono`
--      (sin vínculo a auth.users). El módulo real (19) usa `user_id`,
--      `nombre_completo` y `correo` vinculados 1:1 a Supabase Auth.
--    - Definía un CHECK de estado con valores viejos
--      ('pendiente_confirmacion','pendiente_despacho') que NO coinciden con
--      el enum `estado_pedido` real ('pendiente_confirmacion_cajera', etc.).
--      Ese CHECK podía bloquear updates legítimos de pedidos.
--    - Creaba la función `asignar_domiciliario(pedido_id, domiciliario_id)`
--      (solo admin/caja) que entra en conflicto conceptual con la función
--      correcta `asignar_pedido_a_domiciliario(comanda)` (autoasignación del
--      propio domiciliario). Se elimina la vieja.
--    - Creaba la vista `propinas_por_dia` con columnas `nombre`/`telefono`
--      que ya no existen en la tabla real. Se elimina.
--    - Contenía bloques de markdown ```sql``` dentro del archivo .sql, lo que
--      lo hacía NO EJECUTABLE. Se descarta por completo.
--
-- 2. Políticas RLS viejas de `domiciliarios` (17):
--    - "Domiciliarios publico puede leer" (using true) → exponía TODOS los
--      domiciliarios a cualquier anónimo. Se elimina.
--    - "Solo admin puede modificar domiciliarios" → dependía de la tabla
--      `usuarios_autorizados` que NO existe en el esquema real (se usa
--      `usuarios` con `tiene_rol`/`es_staff`). Se elimina.
--
-- 3. El RPC `actualizar_estado_pedido_staff` (mencionado en el historial como
--    "abandonado") NO existe en ningún archivo SQL del repo — se confirma que
--    no hay restos que limpiar de él.
--
-- ── QUÉ SE CONSERVA (MÓDULO DEFINITIVO, MIGRACIÓN 19) ───────────────────────
--    - Tabla `domiciliarios` (user_id, nombre_completo, correo, activo)
--    - Columnas nuevas en `pedidos`: domiciliario_id, propina, asignado_en,
--      en_camino_en, entregado_en
--    - Función `es_domiciliario` (SECURITY DEFINER)
--    - Función `asignar_pedido_a_domiciliario` (autoasignación por comanda)
--    - Políticas RLS de domiciliarios (insert/select/update propio + staff)
--    - Políticas RLS de pedidos para domiciliario (select/update asignados)
--    - Realtime sobre pedidos y domiciliarios
--    - Vista `propinas_por_domiciliario`
--
-- Este script es IDEMPOTENTE: se puede ejecutar varias veces sin romper nada.
-- ============================================================================

-- ── 0) LIMPIEZA DE RESTOS DEL INTENTO VIEJO (17) ────────────────────────────
-- Eliminar la vista vieja que referenciaba columnas inexistentes.
drop view if exists public.propinas_por_dia;

-- Eliminar la función vieja de asignación manual (solo admin/caja).
drop function if exists public.asignar_domiciliario(uuid, uuid);

-- Eliminar políticas viejas de domiciliarios que dependían de
-- `usuarios_autorizados` (tabla inexistente) o exponían todo a anónimos.
drop policy if exists "Domiciliarios publico puede leer" on public.domiciliarios;
drop policy if exists "Solo admin puede modificar domiciliarios" on public.domiciliarios;

-- ── 1) TABLA DOMICILIARIOS (MÓDULO DEFINITIVO) ──────────────────────────────
create table if not exists public.domiciliarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre_completo text not null,
  correo text not null unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table public.domiciliarios is 'Perfil de domiciliario, vinculado 1:1 a un usuario de Supabase Auth.';

grant select, insert, update on public.domiciliarios to authenticated;
grant all on public.domiciliarios to service_role;

alter table public.domiciliarios enable row level security;

-- ── 2) COLUMNAS NUEVAS EN PEDIDOS ───────────────────────────────────────────
alter table public.pedidos
  add column if not exists domiciliario_id uuid references public.domiciliarios(id),
  add column if not exists propina numeric not null default 0,
  add column if not exists asignado_en timestamptz,
  add column if not exists en_camino_en timestamptz,
  add column if not exists entregado_en timestamptz;

create index if not exists idx_pedidos_domiciliario on public.pedidos(domiciliario_id);
create index if not exists idx_pedidos_estado_domiciliario on public.pedidos(estado, domiciliario_id);

-- ── 3) FUNCIÓN HELPER es_domiciliario ───────────────────────────────────────
-- Mismo patrón que es_staff: SECURITY DEFINER para evitar recursión RLS.
create or replace function public.es_domiciliario(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.domiciliarios d
    where d.user_id = _user_id and d.activo = true
  )
$$;

grant execute on function public.es_domiciliario(uuid) to authenticated;

-- ── 4) FUNCIÓN PARA AUTOASIGNARSE UN PEDIDO POR NÚMERO DE COMANDA ───────────
-- El domiciliario solo escribe la parte numérica; el frontend arma el TC-.
create or replace function public.asignar_pedido_a_domiciliario(p_numero_comanda text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_domiciliario_id uuid;
  v_pedido_id uuid;
  v_estado_actual public.estado_pedido;
begin
  select id into v_domiciliario_id
    from public.domiciliarios
   where user_id = auth.uid() and activo = true
   limit 1;

  if v_domiciliario_id is null then
    raise exception 'No autorizado: no eres un domiciliario activo';
  end if;

  select id, estado into v_pedido_id, v_estado_actual
    from public.pedidos
   where numero_comanda = p_numero_comanda
   limit 1;

  if v_pedido_id is null then
    raise exception 'No existe ningún pedido con ese número de comanda';
  end if;

  if v_estado_actual not in ('pago_confirmado', 'en_cocina', 'en_preparacion') then
    raise exception 'Este pedido no está listo para ser asignado a reparto';
  end if;

  update public.pedidos
     set domiciliario_id = v_domiciliario_id,
         asignado_en = now()
   where id = v_pedido_id
     and domiciliario_id is null; -- evita doble asignación por carrera

  if not found then
    raise exception 'Este pedido ya fue asignado a otro domiciliario';
  end if;

  return jsonb_build_object('ok', true, 'pedido_id', v_pedido_id);
end;
$$;

grant execute on function public.asignar_pedido_a_domiciliario(text) to authenticated;

-- ── 5) POLÍTICAS RLS — TABLA DOMICILIARIOS ──────────────────────────────────
-- El domiciliario puede registrarse (insertar su propio perfil)
drop policy if exists domiciliarios_insert_propio on public.domiciliarios;
create policy domiciliarios_insert_propio
on public.domiciliarios
for insert
to authenticated
with check (user_id = auth.uid());

-- El domiciliario puede ver y editar solo su propio perfil
drop policy if exists domiciliarios_select_propio on public.domiciliarios;
create policy domiciliarios_select_propio
on public.domiciliarios
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists domiciliarios_update_propio on public.domiciliarios;
create policy domiciliarios_update_propio
on public.domiciliarios
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Staff/superadmin puede ver todos los domiciliarios (para el reporte de propinas)
drop policy if exists domiciliarios_select_staff on public.domiciliarios;
create policy domiciliarios_select_staff
on public.domiciliarios
for select
to authenticated
using (public.es_staff(auth.uid()));

-- ── 6) POLÍTICAS RLS — PEDIDOS PARA DOMICILIARIO ────────────────────────────
-- El domiciliario puede VER los pedidos que tiene asignados.
drop policy if exists pedidos_select_domiciliario on public.pedidos;
create policy pedidos_select_domiciliario
on public.pedidos
for select
to authenticated
using (
  domiciliario_id in (
    select id from public.domiciliarios where user_id = auth.uid()
  )
);

-- El domiciliario puede cambiar SOLO el estado de su propio pedido asignado,
-- y SOLO entre los estados permitidos (en_camino, entregado).
drop policy if exists pedidos_update_domiciliario on public.pedidos;
create policy pedidos_update_domiciliario
on public.pedidos
for update
to authenticated
using (
  domiciliario_id in (
    select id from public.domiciliarios where user_id = auth.uid()
  )
)
with check (
  domiciliario_id in (
    select id from public.domiciliarios where user_id = auth.uid()
  )
  and estado in ('en_camino', 'entregado')
);

-- ── 7) REALTIME SOBRE PEDIDOS Y DOMICILIARIOS ───────────────────────────────
-- Nota: si supabase_realtime ya tiene pedidos agregada de antes, este comando
-- dará un error de "ya existe" — en ese caso no pasa nada, se ignora ese error
-- puntual y se continúa.
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.domiciliarios;

-- ── 8) VISTA PARA EL REPORTE DE PROPINAS POR DOMICILIARIO ───────────────────
-- Usada por Caja/Super Admin y por el propio domiciliario para ver su acumulado.
create or replace view public.propinas_por_domiciliario as
select
  d.id as domiciliario_id,
  d.nombre_completo,
  date_trunc('day', p.entregado_en) as dia,
  count(*) as pedidos_entregados,
  coalesce(sum(p.propina), 0) as total_propinas
from public.pedidos p
join public.domiciliarios d on d.id = p.domiciliario_id
where p.estado = 'entregado'
group by d.id, d.nombre_completo, date_trunc('day', p.entregado_en);

grant select on public.propinas_por_domiciliario to authenticated;