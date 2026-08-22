-- ============================================================
-- MÓDULO DOMICILIARIO: Roles + permisos + propinas
-- ============================================================

-- 1) Extender el tipo de estado
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estado_check CHECK (estado IN (
  'pendiente_confirmacion',
  'pendiente_despacho',
  'en_cocina',
  'en_camino',
  'entregado',
  'cancelado'
));

-- 2) Crear tabla de domiciliarios
create table if not exists public.domiciliarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) RLS domiciliarios
alter table public.domiciliarios enable row level security;

drop policy if exists "Domiciliarios publico puede leer" on public.domiciliarios;
create policy "Domiciliarios publico puede leer"
  on public.domiciliarios for select
  using (true);

drop policy if exists "Solo admin puede modificar domiciliarios" on public.domiciliarios;
create policy "Solo admin puede modificar domiciliarios"
  on public.domiciliarios for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios_autorizados ua
      where ua.rol = 'admin'
        and ua.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.usuarios_autorizados ua
      where ua.rol = 'admin'
        and ua.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 4) ASIGNAR DOMICILIARIO A PEDIDO (solo admin/caja)
-- ============================================================
create or replace function public.asignar_domiciliario(
  p_pedido_id uuid,
  p_domiciliario_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pedidos
     set domiciliario_id = p_domiciliario_id
   where id = p_pedido_id;
end;
$$;

-- ============================================================
-- 5) VISTA: Propinas por día para cada domiciliario
-- ============================================================
create or replace view public.propinas_por_dia as
select
  d.id as domiciliario_id,
  d.nombre,
  date(p.entregado_en) as dia,
  count(p.id) as pedidos_entregados,
  coalesce(sum(p.propina), 0) as total_propinas,
  coalesce(p.estado, 'entregado') as estado
from public.domiciliarios d
left join public.pedidos p on p.domiciliario_id = d.id and p.estado = 'entregado'
group by d.id, d.nombre, date(p.entregado_en);
```

```sql
-- Vista para el dashboard de domiciliario
create or replace view public.vista_pedidos_domiciliario
with (security_invoker = true)
as
select
  p.id,
  p.numero_comanda,
  p.estado,
  p.direccion_entrega,
  p.barrio,
  p.nombre_cliente,
  p.telefono_cliente,
  p.total,
  p.propina,
  p.entregado_en,
  p.actualizado_en,
  d.id as domiciliario_id,
  d.nombre as domiciliario_nombre
from public.pedidos p
left join public.usuarios_domiciliarios d on d.id = p.domiciliario_id;