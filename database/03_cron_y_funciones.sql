-- ============================================================================
-- TREMENDO CHICHARRÓN — 03. CRON, RATE LIMITING Y AUTOMATIZACIONES
-- Ejecutar DESPUÉS de 02_rls.sql.
-- ============================================================================

create extension if not exists pg_cron;

-- ── Auto-cancelación de pedidos sin pago ────────────────────────────────────
-- Pasa a 'cancelado' todo pedido sin pago confirmado con más de 30 minutos.
create or replace function public.cancelar_pedidos_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare afectados integer;
begin
  update public.pedidos
     set estado = 'cancelado'
   where estado in ('pendiente_pago','pendiente_confirmacion_cajera')
     and creado_en < now() - interval '30 minutes';
  get diagnostics afectados = row_count;
  return afectados;
end $$;

-- Se ejecuta cada minuto.
select cron.unschedule('cancelar-pedidos-vencidos')
  where exists (select 1 from cron.job where jobname = 'cancelar-pedidos-vencidos');

select cron.schedule(
  'cancelar-pedidos-vencidos',
  '* * * * *',
  $$select public.cancelar_pedidos_vencidos()$$
);

-- ── Rate limiting básico ────────────────────────────────────────────────────
-- Tabla contador por identificador (IP o sesión) y acción. Las Edge Functions
-- críticas (crear_pedido, chat_don_velto) llaman a public.consumir_rate_limit().
create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  identificador text not null,       -- IP o session id
  accion text not null,              -- 'crear_pedido' | 'chat_don_velto'
  ventana_inicio timestamptz not null default now(),
  conteo int not null default 0,
  unique (identificador, accion)
);
comment on table public.rate_limits is 'Contadores de rate limiting por IP/sesión y acción.';

grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;
-- Sin políticas: solo el service_role (Edge Functions) puede tocar esta tabla.

-- Devuelve true si la petición se permite; false si excede el límite.
create or replace function public.consumir_rate_limit(
  _identificador text,
  _accion text,
  _limite int default 5,
  _ventana interval default interval '1 minute'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare fila public.rate_limits%rowtype;
begin
  insert into public.rate_limits (identificador, accion, conteo)
  values (_identificador, _accion, 1)
  on conflict (identificador, accion) do update
    set conteo = case
          when public.rate_limits.ventana_inicio < now() - _ventana then 1
          else public.rate_limits.conteo + 1 end,
        ventana_inicio = case
          when public.rate_limits.ventana_inicio < now() - _ventana then now()
          else public.rate_limits.ventana_inicio end
  returning * into fila;

  return fila.conteo <= _limite;
end $$;

-- Límites sugeridos:
--   crear_pedido    → 5 por minuto por IP
--   chat_don_velto  → 8 por minuto por sesión

-- ── Limpieza de rate limits viejos (diaria) ─────────────────────────────────
select cron.unschedule('limpiar-rate-limits')
  where exists (select 1 from cron.job where jobname = 'limpiar-rate-limits');

select cron.schedule(
  'limpiar-rate-limits',
  '0 4 * * *',
  $$delete from public.rate_limits where ventana_inicio < now() - interval '1 day'$$
);

-- ── Vista de métricas para el panel del superadmin ──────────────────────────
create or replace view public.metricas_mensuales as
select
  date_trunc('month', creado_en) as mes,
  count(*) filter (where estado <> 'cancelado')          as pedidos_validos,
  count(*) filter (where estado = 'cancelado')           as pedidos_cancelados,
  coalesce(sum(total) filter (where estado <> 'cancelado'), 0) as ventas_totales,
  coalesce(avg(total) filter (where estado <> 'cancelado'), 0) as ticket_promedio
from public.pedidos
group by 1
order by 1 desc;

grant select on public.metricas_mensuales to authenticated;