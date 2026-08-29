-- ==========================================================================
-- TREMENDO CHICHARRÓN — 29. PRIVACIDAD DEFENSA EN PROFUNDIDAD DE PEDIDOS
--
-- La consulta pública debe filtrar por teléfono tanto en PostgREST como en
-- RLS. Sin el header x-cliente-telefono, un cliente anónimo no obtiene filas.
-- ==========================================================================

drop policy if exists pedidos_select_publico on public.pedidos;
drop policy if exists pedidos_select_todos on public.pedidos;
drop policy if exists pedidos_select_anon on public.pedidos;
create policy pedidos_select_anon on public.pedidos
  for select to anon
  using (
    cliente_telefono = current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
  );

-- Los items contienen el detalle del pedido y deben tener la misma barrera.
drop policy if exists items_select_publico on public.pedido_items;
drop policy if exists items_select_anon on public.pedido_items;
create policy items_select_anon on public.pedido_items
  for select to anon
  using (
    exists (
      select 1
        from public.pedidos p
       where p.id = pedido_items.pedido_id
         and p.cliente_telefono =
           current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
    )
  );
