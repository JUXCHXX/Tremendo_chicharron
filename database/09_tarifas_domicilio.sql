-- ============================================================================
-- TREMENDO CHICHARRÓN — 09. TARIFAS DE DOMICILIO + BARRIO EN PEDIDOS
-- Ejecutar DESPUÉS de 01_esquema.sql y 02_rls.sql.
-- ============================================================================

-- ── tarifas_domicilio ───────────────────────────────────────────────────────
-- Catálogo de barrios con su tarifa de domicilio. Lectura pública para el
-- combobox del checkout; escritura solo del superadmin.
create table if not exists public.tarifas_domicilio (
  ubicacion text primary key,
  tarifa numeric(12,2) not null check (tarifa >= 0),
  creado_en timestamptz not null default now()
);
comment on table public.tarifas_domicilio is 'Barrios y tarifas de domicilio para el checkout.';

grant select on public.tarifas_domicilio to anon, authenticated;
grant insert, update, delete on public.tarifas_domicilio to authenticated;
grant all on public.tarifas_domicilio to service_role;

alter table public.tarifas_domicilio enable row level security;

drop policy if exists tarifas_select_publico on public.tarifas_domicilio;
create policy tarifas_select_publico on public.tarifas_domicilio
  for select to anon, authenticated using (true);

drop policy if exists tarifas_write_superadmin on public.tarifas_domicilio;
create policy tarifas_write_superadmin on public.tarifas_domicilio
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

-- ── barrio en pedidos ───────────────────────────────────────────────────────
alter table public.pedidos
  add column if not exists barrio text;
comment on column public.pedidos.barrio is 'Barrio seleccionado por el cliente (de tarifas_domicilio).';