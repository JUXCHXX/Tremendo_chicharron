-- ============================================================================
-- TREMENDO CHICHARRÓN — 11. VALORACIONES (RESEÑAS POR PLATO)
-- Ejecutar DESPUÉS de 01_esquema.sql y 02_rls.sql.
-- ============================================================================

-- ── valoraciones ────────────────────────────────────────────────────────────
-- Cada valoración está vinculada a un pedido entregado y a un plato del menú.
-- El cliente puede calificar SOLO después de que su pedido fue entregado.
-- No es anónima: se reutiliza el nombre y teléfono que el cliente dio al pedir.
create table if not exists public.valoraciones (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  pedido_item_id uuid references public.pedido_items(id) on delete set null,
  producto_id uuid not null references public.productos(id) on delete cascade,
  cliente_nombre text not null,
  cliente_telefono text not null,
  calificacion numeric(2,1) not null check (calificacion >= 1 and calificacion <= 5),
  comentario text,
  creado_en timestamptz not null default now(),
  unique (pedido_id, producto_id)
);
comment on table public.valoraciones is
  'Reseñas de clientes por plato, vinculadas a un pedido entregado. Una valoración por plato por pedido.';

create index if not exists idx_valoraciones_producto on public.valoraciones(producto_id);
create index if not exists idx_valoraciones_pedido on public.valoraciones(pedido_id);
create index if not exists idx_valoraciones_creado on public.valoraciones(creado_en desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.valoraciones enable row level security;

-- Lectura pública: cualquiera puede ver las valoraciones (menú público).
drop policy if exists valoraciones_select_publico on public.valoraciones;
create policy valoraciones_select_publico on public.valoraciones
  for select to anon, authenticated using (true);

-- Inserción: el cliente anónimo puede insertar SOLO si:
--   1. El pedido existe y está en estado 'entregado'
--   2. El teléfono del cliente coincide con el del pedido
--   3. El producto realmente está en ese pedido
--   4. No existe ya una valoración para ese pedido+producto
drop policy if exists valoraciones_insert_publico on public.valoraciones;
create policy valoraciones_insert_publico on public.valoraciones
  for insert to anon, authenticated
  with check (
    exists (
      select 1
        from public.pedidos p
       where p.id = pedido_id
         and p.estado = 'entregado'
         and p.cliente_telefono = cliente_telefono
    )
    and exists (
      select 1
        from public.pedido_items pi
       where pi.pedido_id = pedido_id
         and pi.producto_id = producto_id
    )
    and not exists (
      select 1
        from public.valoraciones v
       where v.pedido_id = pedido_id
         and v.producto_id = producto_id
    )
  );

-- El staff puede borrar valoraciones inapropiadas.
drop policy if exists valoraciones_delete_staff on public.valoraciones;
create policy valoraciones_delete_staff on public.valoraciones
  for delete to authenticated
  using (public.es_staff(auth.uid()));

-- ── Vista de resumen por producto ───────────────────────────────────────────
-- Promedio y cantidad de valoraciones por plato, para mostrar en el menú.
create or replace view public.resumen_valoraciones as
select
  producto_id,
  count(*)::int as cantidad,
  round(avg(calificacion)::numeric, 1) as promedio
from public.valoraciones
group by producto_id;

grant select on public.resumen_valoraciones to anon, authenticated;