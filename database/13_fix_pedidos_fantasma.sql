-- ============================================================================
-- TREMENDO CHICHARRÓN — 13. FIX PEDIDOS FANTASMA
-- ----------------------------------------------------------------------------
-- Problema: los pedidos se generaban del lado del cliente (número de comanda
-- calculado en localStorage) pero no llegaban a Caja ni a Super Administración.
--
-- Causas raíz:
--   1. El número de comanda se generaba en el cliente contando SOLO sus propios
--      pedidos locales → todos generaban "TC-YYMMDD-001" → colisión con la
--      constraint UNIQUE de pedidos.numero_comanda → el INSERT fallaba.
--   2. El fallo del INSERT se ignoraba (solo console.error) y el pedido quedaba
--      "fantasma" (solo en localStorage, invisible para Caja/SuperAdmin).
--   3. La política RLS pedidos_insert_publico exigía negocio_abierto = true;
--      si la fila de configuracion no existía, el subquery devolvía NULL y el
--      INSERT se rechazaba.
--
-- Solución:
--   - Asegurar que exista la fila de configuracion (id = true).
--   - Hacer la política de INSERT tolerante a configuracion ausente (coalesce).
--   - Sincronizar la secuencia comanda_seq con el máximo de pedidos existentes
--     para que los nuevos números de comanda no colisionen con los históricos.
-- ============================================================================

-- 1) Asegurar la fila de configuración (negocio abierto por defecto).
insert into public.configuracion (id, negocio_abierto)
values (true, true)
on conflict (id) do nothing;

-- 2) Corregir la política de INSERT de pedidos: si la fila de configuracion
--    no existe, se asume negocio abierto (coalesce) en lugar de rechazar.
drop policy if exists pedidos_insert_publico on public.pedidos;
create policy pedidos_insert_publico on public.pedidos
  for insert to anon, authenticated
  with check (
    estado in ('pendiente_confirmacion_cajera','pendiente_pago')
    and coalesce((select negocio_abierto from public.configuracion where id), true) = true
  );

-- 3) Sincronizar la secuencia de comandas con el máximo de pedidos existentes.
--    Esto evita que un nuevo pedido genere un número de comanda que ya exista.
select setval(
  'public.comanda_seq',
  greatest(
    (select coalesce(max((regexp_match(numero_comanda, '-([0-9]+)$'))[1])::bigint, 0)
       from public.pedidos),
    (select last_value from public.comanda_seq)
  )
);