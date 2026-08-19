-- ============================================================================
-- TREMENDO CHICHARRÓN — 15. FIX PRIVACIDAD: MI CHICHARRONERA SOLO VÉ SU PEDIDO
-- ----------------------------------------------------------------------------
-- Problema: "Mi Chicharronera" mostraba pedidos de otros clientes.
--
-- Causa raíz (frontend): usePedidosRealtime() consultaba la tabla `pedidos`
-- SIN filtro ni header cuando no había teléfono. Si el usuario tenía sesión de
-- staff en el mismo navegador, la política pedidos_select_staff devolvía TODOS
-- los pedidos (fuga de datos).
--
-- Corrección frontend (ya aplicada en use-pedidos.ts):
--   - Si no hay teléfono, NO se consulta nada (setPedidos([])).
--   - Si hay teléfono, se filtra por cliente_telefono Y se envía el header
--     x-cliente-telefono requerido por la política pedidos_select_anon.
--
-- Refuerzo en BD (este archivo):
--   - Recrear pedidos_select_anon para que EXIJA el header x-cliente-telefono
--     y filtre por él. Sin header → 0 filas (nunca expone pedidos ajenos).
--   - Confirmar que NO existe ninguna política SELECT abierta (using true)
--     para anon sobre pedidos. Solo staff autenticado (es_staff) ve todo.
--   - Recrear items_select_staff para que el cliente anónimo NO pueda leer
--     items de pedidos ajenos directamente (solo vía RPC segura).
-- ============================================================================

-- 1) Política SELECT de pedidos para anon: SOLO con header y teléfono coincidente.
--    Sin header → current_setting devuelve NULL → NULL = telefono es NULL → 0 filas.
drop policy if exists pedidos_select_anon on public.pedidos;
create policy pedidos_select_anon on public.pedidos
  for select to anon
  using (
    cliente_telefono = current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
  );

-- 2) Confirmar que NO existe política SELECT abierta para anon sobre pedidos.
--    (La política pedidos_select_staff solo aplica a authenticated con es_staff.)
--    Si existiera una política con `using (true)` para anon, este archivo la elimina.
drop policy if exists pedidos_select_publico on public.pedidos;
drop policy if exists pedidos_select_todos on public.pedidos;

-- 3) Reforzar items: el cliente anónimo NO puede leer items directamente.
--    Solo el staff autenticado. La lectura del cliente pasa por la RPC
--    consultar_pedido_por_comanda_y_telefono() (SECURITY DEFINER).
drop policy if exists items_select_publico on public.pedido_items;
drop policy if exists items_select_anon on public.pedido_items;
drop policy if exists items_select_staff on public.pedido_items;
create policy items_select_staff on public.pedido_items
  for select to authenticated
  using (public.es_staff(auth.uid()));

-- 4) Verificación de diagnóstico (opcional, ejecutar manualmente):
--    set role anon;
--    select * from public.pedidos;  -- debe devolver 0 filas (sin header)
--    reset role;