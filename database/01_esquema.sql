-- ============================================================================
-- TREMENDO CHICHARRÓN — 01. ESQUEMA
-- Copia y pega este archivo COMPLETO en el SQL Editor de Supabase (primero).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Tipos ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.rol_usuario as enum ('superadmin', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_pedido as enum (
    'pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado','en_cocina','en_preparacion','en_camino','entregado','cancelado'
  );
exception when duplicate_object then null; end $$;

-- Si el tipo ya existe con el estado anterior, agrégalo:
do $$ begin
  alter type public.estado_pedido add value 'pendiente_confirmacion_cajera';
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.medio_pago as enum ('efectivo','transferencia','tarjeta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_vigencia as enum ('fija','rotativa','por_fecha');
exception when duplicate_object then null; end $$;

-- ── usuarios ────────────────────────────────────────────────────────────────
-- Roles del staff. Los usuarios se crean MANUALMENTE desde el panel de
-- Supabase (Auth > Users) y luego se les inserta aquí su rol.
-- No existe registro público en la aplicación.
create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  rol public.rol_usuario not null,
  nombre text not null,
  creado_en timestamptz not null default now()
);
comment on table public.usuarios is 'Roles del staff (superadmin = dueño, admin = cajera).';

grant select on public.usuarios to authenticated;
grant all on public.usuarios to service_role;

-- Función SECURITY DEFINER para consultar rol sin recursión en las políticas.
create or replace function public.tiene_rol(_user_id uuid, _rol public.rol_usuario)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.usuarios u where u.user_id = _user_id and u.rol = _rol)
$$;

create or replace function public.es_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.usuarios u where u.user_id = _user_id)
$$;

-- ── configuracion ───────────────────────────────────────────────────────────
-- Fila única con el interruptor global de "negocio abierto/cerrado".
create table if not exists public.configuracion (
  id boolean primary key default true check (id),
  negocio_abierto boolean not null default true,
  ultimo_respaldo timestamptz,
  actualizado_en timestamptz not null default now()
);
comment on table public.configuracion is 'Configuración global: abrir/cerrar el negocio y control de respaldos.';

grant select on public.configuracion to anon, authenticated;
grant update on public.configuracion to authenticated;
grant all on public.configuracion to service_role;

-- ── categorias ──────────────────────────────────────────────────────────────
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null default 0,
  plato_destacado_id uuid,          -- FK se agrega abajo (referencia circular con productos)
  modelo_3d_url text,
  creado_en timestamptz not null default now()
);
comment on table public.categorias is 'Categorías del menú (Desayunos, Almuerzos, Para Picar, Bebidas).';

grant select on public.categorias to anon, authenticated;
grant insert, update, delete on public.categorias to authenticated;
grant all on public.categorias to service_role;

-- ── productos ───────────────────────────────────────────────────────────────
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  nombre text not null,
  descripcion text not null default '',
  precio numeric(12,2),             -- null = precio por definir o por variante
  imagen_url text,
  disponible boolean not null default true,   -- false = "sold out"
  destacado_3d boolean not null default false,
  modelo_3d_url text,
  por_persona boolean not null default false, -- usa variantes_precio (picada)
  combo_gratis boolean not null default false,-- hamburguesa: combo sin costo
  orden int not null default 0,
  creado_en timestamptz not null default now()
);
comment on table public.productos is 'Platos del menú, con control de disponibilidad y modelo 3D.';

grant select on public.productos to anon, authenticated;
grant insert, update, delete on public.productos to authenticated;
grant all on public.productos to service_role;

create index if not exists idx_productos_categoria on public.productos(categoria_id);
create index if not exists idx_productos_disponible on public.productos(disponible);

alter table public.categorias
  drop constraint if exists categorias_plato_destacado_fk;
alter table public.categorias
  add constraint categorias_plato_destacado_fk
  foreign key (plato_destacado_id) references public.productos(id) on delete set null;

-- ── variantes_precio ────────────────────────────────────────────────────────
create table if not exists public.variantes_precio (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  cantidad_personas int not null check (cantidad_personas > 0),
  precio numeric(12,2) not null check (precio >= 0),
  unique (producto_id, cantidad_personas)
);
comment on table public.variantes_precio is 'Precios por número de personas (Picada de Chicharrón).';

grant select on public.variantes_precio to anon, authenticated;
grant insert, update, delete on public.variantes_precio to authenticated;
grant all on public.variantes_precio to service_role;

create index if not exists idx_variantes_producto on public.variantes_precio(producto_id);

-- ── promociones ─────────────────────────────────────────────────────────────
create table if not exists public.promociones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null default '',
  imagen_url text,
  tipo_vigencia public.tipo_vigencia not null default 'fija',
  fecha_inicio date,
  fecha_fin date,
  dia_semana int check (dia_semana between 0 and 6), -- 0 = domingo
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);
comment on table public.promociones is 'Promociones fijas, rotativas o por fecha/día de la semana.';

grant select on public.promociones to anon, authenticated;
grant insert, update, delete on public.promociones to authenticated;
grant all on public.promociones to service_role;

create index if not exists idx_promociones_activa on public.promociones(activa);

-- ── clientes ────────────────────────────────────────────────────────────────
-- Registro del cliente (nombre + teléfono) para precargar sus pedidos.
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null unique,
  creado_en timestamptz not null default now()
);
comment on table public.clientes is 'Clientes registrados desde el mini-login (nombre + teléfono).';

grant select, insert, update on public.clientes to anon, authenticated;
grant all on public.clientes to service_role;

-- ── pedidos ─────────────────────────────────────────────────────────────────
create sequence if not exists public.comanda_seq;

create or replace function public.generar_numero_comanda()
returns text
language sql
volatile
as $$
  select 'TC-' || to_char(now() at time zone 'America/Bogota', 'YYMMDD')
         || '-' || lpad((nextval('public.comanda_seq') % 1000)::text, 3, '0')
$$;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_comanda text not null unique default public.generar_numero_comanda(),
  cliente_nombre text not null,
  cliente_telefono text not null,
  direccion_entrega text not null,
  medio_pago public.medio_pago not null,
  monto_efectivo_recibido numeric(12,2),
  vuelto numeric(12,2),
  valor_domicilio numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado public.estado_pedido not null default 'pendiente_confirmacion_cajera',
  version int not null default 1,
  creado_en timestamptz not null default now(),
  editable_hasta timestamptz not null default now() + interval '10 minutes'
);
comment on table public.pedidos is 'Pedidos del cliente. La versión activa es la única que se procesa.';

grant select, insert on public.pedidos to anon;         -- cliente sin login
grant select, insert, update on public.pedidos to authenticated;
grant all on public.pedidos to service_role;

create unique index if not exists idx_pedidos_comanda on public.pedidos(numero_comanda);
create index if not exists idx_pedidos_estado on public.pedidos(estado);
create index if not exists idx_pedidos_creado on public.pedidos(creado_en desc);
create index if not exists idx_pedidos_telefono on public.pedidos(cliente_telefono);

-- ── pedido_items ────────────────────────────────────────────────────────────
create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre_producto text not null,     -- snapshot: el nombre no cambia si editan el menú
  cantidad int not null check (cantidad > 0),
  variante_personas int,
  combo boolean not null default false,
  notas text not null default '',
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0)
);
comment on table public.pedido_items is 'Líneas de cada pedido, con snapshot de nombre y precio.';

grant select, insert on public.pedido_items to anon;
grant select, insert, update, delete on public.pedido_items to authenticated;
grant all on public.pedido_items to service_role;

create index if not exists idx_items_pedido on public.pedido_items(pedido_id);

-- ── historico_comandas ──────────────────────────────────────────────────────
-- Rastro de las versiones anuladas: la cajera edita, se archiva la versión
-- vieja aquí y el sistema NUNCA vuelve a leerla como activa.
create table if not exists public.historico_comandas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  numero_comanda text not null,
  version int not null,
  snapshot jsonb not null,
  motivo text not null default 'Edición de comanda',
  anulada_en timestamptz not null default now()
);
comment on table public.historico_comandas is 'Versiones anuladas de comandas (solo auditoría, nunca se procesan).';

grant select, insert on public.historico_comandas to authenticated;
grant all on public.historico_comandas to service_role;

create index if not exists idx_historico_comanda on public.historico_comandas(numero_comanda);

-- Al editar una comanda: archiva la versión anterior y sube el número de versión.
create or replace function public.archivar_version_comanda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.version > old.version then
    insert into public.historico_comandas (pedido_id, numero_comanda, version, snapshot)
    values (old.id, old.numero_comanda, old.version, to_jsonb(old));
  end if;
  return new;
end $$;

drop trigger if exists trg_archivar_version on public.pedidos;
create trigger trg_archivar_version
  before update on public.pedidos
  for each row execute function public.archivar_version_comanda();