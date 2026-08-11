-- ============================================================================
-- TREMENDO CHICHARRÓN — 06. FIX RLS: pedido_items
-- Corrige la política de lectura pública de `pedido_items` para que un
-- cliente anónimo NO pueda hacer SELECT directo sobre la tabla y exponer
-- items de pedidos ajenos. La lectura pública solo debe funcionar a través
-- de la RPC segura `consultar_pedido_por_comanda_y_telefono()`.
--
-- Ejecutar DESPUÉS de 02_rls.sql (migración aislada, no re-ejecuta el esquema).
-- ============================================================================

-- Eliminar la política insegura actual que expone todos los items
drop policy if exists items_select_publico on public.pedido_items;

-- Nueva política: solo el staff (admin/superadmin) puede leer pedido_items
-- directamente. Los clientes anónimos NO pueden hacer SELECT directo;
-- su acceso pasa exclusivamente por la RPC
-- consultar_pedido_por_comanda_y_telefono() (SECURITY DEFINER).
create policy items_select_staff on public.pedido_items
  for select to authenticated
  using (public.es_staff(auth.uid()));

-- Nota: la RPC `consultar_pedido_por_comanda_y_telefono()` ya es SECURITY
-- DEFINER y ejecuta con privilegios del owner, por lo que puede leer
-- pedido_items sin necesidad de una política SELECT para anon.
-- El cliente anónimo ya no puede hacer `select * from pedido_items`.