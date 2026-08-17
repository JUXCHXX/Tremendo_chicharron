-- ============================================================================
-- TREMENDO CHICHARRÓN — 10. FIX RLS: bloquear pedido_items de productos agotados
-- Capa extra de seguridad: aunque alguien manipule el frontend, la base de
-- datos NO permite insertar un pedido_item cuyo producto tenga disponible = false.
--
-- Ejecutar DESPUÉS de 02_rls.sql y 06_fix_rls_pedido_items.sql.
-- ============================================================================

-- Reemplazar la política de INSERT de pedido_items para que verifique que el
-- producto esté disponible (disponible = true) antes de permitir la inserción.
drop policy if exists items_insert_publico on public.pedido_items;
create policy items_insert_publico on public.pedido_items
  for insert to anon, authenticated
  with check (
    -- Si el producto existe, debe estar disponible. Si no existe (producto_id null),
    -- se permite (por ejemplo, snapshot de un producto eliminado).
    (
      producto_id is null
      or exists (
        select 1 from public.productos p
        where p.id = producto_id and p.disponible = true
      )
    )
  );

-- También bloquear el UPDATE de items para que no se pueda reactivar un item
-- de un producto agotado dentro de la ventana de edición del cliente.
drop policy if exists items_update_ventana_cliente on public.pedido_items;
create policy items_update_ventana_cliente on public.pedido_items
  for all to anon
  using (
    exists (select 1 from public.pedidos p where p.id = pedido_id and now() < p.editable_hasta)
  )
  with check (
    exists (select 1 from public.pedidos p where p.id = pedido_id and now() < p.editable_hasta)
    and (
      producto_id is null
      or exists (
        select 1 from public.productos pr
        where pr.id = producto_id and pr.disponible = true
      )
    )
  );