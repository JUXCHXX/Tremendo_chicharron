-- ============================================================================
-- TREMENDO CHICHARRÓN — 05. FIX RLS: clientes_update_propio
-- Corrige la política de actualización de la tabla `clientes` para que un
-- cliente anónimo solo pueda actualizar la fila cuyo teléfono coincida con
-- el que envía en el header `x-cliente-telefono`.
--
-- Ejecutar DESPUÉS de 02_rls.sql (migración aislada, no re-ejecuta el esquema).
-- ============================================================================

-- Eliminar la política insegura actual
drop policy if exists clientes_update_propio on public.clientes;

-- Nueva política: solo permite actualizar la fila cuyo teléfono coincida
-- con el header `x-cliente-telefono` de la request.
create policy clientes_update_propio on public.clientes
  for update to anon, authenticated
  using (
    telefono = current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
  )
  with check (
    telefono = current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
  );