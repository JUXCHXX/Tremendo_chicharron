-- ============================================================================
-- TREMENDO CHICHARRÓN — 21. FIX RLS REGISTRO DE DOMICILIARIOS
-- ----------------------------------------------------------------------------
-- El registro de un nuevo domiciliario falla con:
--   "new row violates row-level security policy for table domiciliarios"
--
-- Causa: la política `domiciliarios_insert_propio` no está aplicada en la
-- base de datos real (o fue eliminada/sobrescrita por un intento anterior).
--
-- Este script garantiza que la política de inserción exista y permita que
-- un usuario autenticado inserte su propia fila en `domiciliarios`.
-- ============================================================================

-- Asegurar que RLS esté habilitado
alter table public.domiciliarios enable row level security;

-- Asegurar permisos de insert para authenticated
grant select, insert, update on public.domiciliarios to authenticated;

-- Política de inserción: el usuario solo puede insertar su propia fila
drop policy if exists domiciliarios_insert_propio on public.domiciliarios;
create policy domiciliarios_insert_propio
on public.domiciliarios
for insert
to authenticated
with check (user_id = auth.uid());

-- Política de select: el usuario solo puede ver su propia fila
drop policy if exists domiciliarios_select_propio on public.domiciliarios;
create policy domiciliarios_select_propio
on public.domiciliarios
for select
to authenticated
using (user_id = auth.uid());

-- Política de update: el usuario solo puede editar su propia fila
drop policy if exists domiciliarios_update_propio on public.domiciliarios;
create policy domiciliarios_update_propio
on public.domiciliarios
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Staff/superadmin puede ver todos los domiciliarios (reporte de propinas)
drop policy if exists domiciliarios_select_staff on public.domiciliarios;
create policy domiciliarios_select_staff
on public.domiciliarios
for select
to authenticated
using (public.es_staff(auth.uid()));