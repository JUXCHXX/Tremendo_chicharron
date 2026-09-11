-- Interruptor global de apertura/cierre: ejecutar una vez en Supabase SQL Editor.
-- La tabla y columna ya existen en instalaciones nuevas; estas sentencias son
-- seguras también para bases creadas con migraciones anteriores.

alter table public.configuracion
  add column if not exists negocio_abierto boolean not null default true;

insert into public.configuracion (id, negocio_abierto)
values (true, true)
on conflict (id) do nothing;

-- RPC atómica para el panel del dueño. Evita depender de que la fila ya exista
-- y conserva la comprobación de rol dentro de la base de datos.
create or replace function public.actualizar_negocio_abierto(p_abierto boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(auth.uid(), 'superadmin') then
    raise exception 'No tienes permisos para cambiar el estado del negocio.'
      using errcode = '42501';
  end if;

  insert into public.configuracion (id, negocio_abierto)
  values (true, p_abierto)
  on conflict (id) do update set negocio_abierto = excluded.negocio_abierto;

  return p_abierto;
end;
$$;

revoke all on function public.actualizar_negocio_abierto(boolean) from public, anon;
grant execute on function public.actualizar_negocio_abierto(boolean) to authenticated;

-- La política protege INSERT directos desde PostgREST. Si por cualquier motivo
-- faltara la fila de configuración, se considera cerrado (fail closed).
drop policy if exists pedidos_insert_publico on public.pedidos;
create policy pedidos_insert_publico on public.pedidos
  for insert to anon, authenticated
  with check (
    estado in ('pendiente_confirmacion_cajera', 'pendiente_pago')
    and coalesce(
      (select negocio_abierto from public.configuracion where id = true),
      false
    ) = true
  );

-- Defensa en profundidad: aplica incluso a inserciones que no pasen por la
-- política anterior (por ejemplo, una RPC SECURITY DEFINER futura).
create or replace function public.rechazar_pedido_si_negocio_cerrado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(
    (select negocio_abierto from public.configuracion where id = true),
    false
  ) then
    raise exception 'El negocio está cerrado por el momento.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_rechazar_si_negocio_cerrado on public.pedidos;
create trigger pedidos_rechazar_si_negocio_cerrado
  before insert on public.pedidos
  for each row execute function public.rechazar_pedido_si_negocio_cerrado();

-- Realtime para que los clientes ya conectados reciban el cambio al instante.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'configuracion'
  ) then
    alter publication supabase_realtime add table public.configuracion;
  end if;
end;
$$;
