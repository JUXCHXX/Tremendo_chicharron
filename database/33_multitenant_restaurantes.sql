-- Registro multi-restaurante usado por la Edge Function chat-don-velto.
-- La función consulta esta tabla con service_role; no se expone a clientes.

create table if not exists public.restaurantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  activo boolean not null default true,
  domicilios_activos boolean not null default true,
  chat_ia_activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.restaurantes enable row level security;

insert into public.restaurantes (
  nombre,
  slug,
  activo,
  domicilios_activos,
  chat_ia_activo
)
values (
  'Tremendo Chicharrón',
  'tremendochicharron',
  true,
  true,
  true
)
on conflict (slug) do update
set nombre = excluded.nombre,
    activo = true,
    domicilios_activos = excluded.domicilios_activos,
    chat_ia_activo = true,
    actualizado_en = now();

grant all on table public.restaurantes to service_role;

select id, nombre, slug, activo, domicilios_activos, chat_ia_activo
from public.restaurantes
where slug = 'tremendochicharron';