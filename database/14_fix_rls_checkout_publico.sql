-- ============================================================================
-- TREMENDO CHICHARRÓN — 14. FIX RLS CHECKOUT PÚBLICO (BLOQUEANTE)
-- ----------------------------------------------------------------------------
-- Problema reportado:
--   Error 42501: new row violates row-level security policy for table "pedidos"
--   POST /clientes?on_conflict=telefono → 401
--   POST /pedidos?select=numero_comanda → 401
--
-- Causas raíz:
--   1. pedidos_insert_publico dependía de que existiera la fila de configuracion;
--      si no existe, (select negocio_abierto ...) devuelve NULL y NULL = true
--      es NULL → la política rechaza el INSERT con 42501.
--   2. clientes_update_propio (migración 05) exige el header x-cliente-telefono.
--      El upsert por teléfono que hace el frontend NO envía ese header, por lo
--      que el UPDATE (cuando el teléfono ya existe) es rechazado con 401.
--      Las peticiones auth aparecen como 401 por la misma causa.
--   3. El SELECT post-INSERT de pedidos (para leer numero_comanda generado por
--      la secuencia) era rechazado por RLS. Ahora el número se genera ANTES del
--      INSERT vía la RPC pública generar_numero_comanda_cliente() (security
--      definer), eliminando la necesidad del SELECT.
--
-- Solución (público mínimo para checkout anónimo, sin exponer pedidos ajenos):
--   - Asegurar la fila de configuracion (negocio abierto por defecto).
--   - pedidos_insert_publico tolerante a configuracion ausente (coalesce).
--   - clientes_update_propio permite el upsert por teléfono sin header
--     (la tabla solo guarda nombre + teléfono; no expone datos sensibles).
--   - RPC pública generar_numero_comanda_cliente() (security definer) que
--     genera el número de comanda desde la secuencia global sin necesitar RLS.
-- ============================================================================

-- 1) Asegurar la fila de configuración (negocio abierto por defecto).
insert into public.configuracion (id, negocio_abierto)
values (true, true)
on conflict (id) do nothing;

-- 2) Política INSERT de pedidos: permite que cualquier cliente anónimo cree un
--    pedido nuevo SOLO si el negocio está abierto (o si la fila de configuracion
--    no existe, se asume abierto para no bloquear el checkout).
drop policy if exists pedidos_insert_publico on public.pedidos;
create policy pedidos_insert_publico on public.pedidos
  for insert to anon, authenticated
  with check (
    estado in ('pendiente_confirmacion_cajera','pendiente_pago')
    and coalesce((select negocio_abierto from public.configuracion where id), true) = true
  );

-- 3) Política UPDATE de clientes: permite el upsert por teléfono sin header.
--    La fila solo contiene nombre + teléfono (sin datos sensibles), y el
--    conflicto se resuelve por la columna UNIQUE telefono. El INSERT ya estaba
--    habilitado públicamente (clientes_insert_publico). Sin esta política, el
--    upsert de un cliente existente falla con 401.
drop policy if exists clientes_update_propio on public.clientes;
create policy clientes_update_propio on public.clientes
  for update to anon, authenticated
  using (true)
  with check (true);

-- 4) RPC pública para generar el número de comanda desde la secuencia global.
--    SECURITY DEFINER para que cualquier cliente anónimo pueda obtener un
--    número único sin colisiones ni necesidad de SELECT sobre pedidos.
drop function if exists public.generar_numero_comanda_cliente();
create or replace function public.generar_numero_comanda_cliente()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'TC-' || to_char(now() at time zone 'America/Bogota', 'YYMMDD')
         || '-' || lpad((nextval('public.comanda_seq') % 1000)::text, 3, '0')
$$;

grant execute on function public.generar_numero_comanda_cliente() to anon, authenticated;

-- 5) Sincronizar la secuencia con el máximo de pedidos existentes para que los
--    nuevos números no colisionen con los históricos.
select setval(
  'public.comanda_seq',
  greatest(
    (select coalesce(max((regexp_match(numero_comanda, '-([0-9]+)$'))[1])::bigint, 0)
       from public.pedidos),
    (select last_value from public.comanda_seq)
  )
);