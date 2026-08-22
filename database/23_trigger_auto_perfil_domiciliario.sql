-- ============================================================================
-- TREMENDO CHICHARRÓN — 23. TRIGGER AUTO-PERFIL DOMICILIARIO
-- ----------------------------------------------------------------------------
-- PROBLEMA: al registrarse un domiciliario, el usuario se crea en auth.users
-- pero NO se inserta su fila en `domiciliarios`. Esto ocurre porque:
--   1. Si la confirmación de email está habilitada, `signUp()` no devuelve
--      sesión activa → el RPC `registrar_domiciliario` falla (auth.uid() null).
--   2. El insert directo falla por RLS.
--
-- SOLUCIÓN DEFINITIVA: un trigger en `auth.users` que inserta automáticamente
-- la fila en `domiciliarios` en el MISMO momento en que se crea el usuario,
-- si su metadata indica rol = 'domiciliario'. No depende de sesión ni de RLS.
-- ============================================================================

-- ── 1) FUNCIÓN DEL TRIGGER ───────────────────────────────────────────────────
create or replace function public.auto_crear_perfil_domiciliario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_nombre text;
begin
  -- Leer el rol y nombre de la metadata del usuario recién creado
  v_rol := coalesce(new.raw_user_meta_data ->> 'rol', '');
  v_nombre := coalesce(new.raw_user_meta_data ->> 'nombre_completo', '');

  -- Solo crear perfil si el rol es domiciliario
  if v_rol = 'domiciliario' then
    insert into public.domiciliarios (user_id, nombre_completo, correo)
    values (new.id, v_nombre, new.email)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ── 2) TRIGGER SOBRE auth.users ──────────────────────────────────────────────
drop trigger if exists trg_auto_crear_perfil_domiciliario on auth.users;
create trigger trg_auto_crear_perfil_domiciliario
after insert on auth.users
for each row
execute function public.auto_crear_perfil_domiciliario();

-- ── 3) GARANTIZAR POLÍTICAS RLS BÁSICAS ─────────────────────────────────────
alter table public.domiciliarios enable row level security;

grant select, insert, update on public.domiciliarios to authenticated;

-- El domiciliario puede ver y editar solo su propio perfil
drop policy if exists domiciliarios_select_propio on public.domiciliarios;
create policy domiciliarios_select_propio
on public.domiciliarios
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists domiciliarios_update_propio on public.domiciliarios;
create policy domiciliarios_update_propio
on public.domiciliarios
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Staff/superadmin puede ver todos los domiciliarios (reporte de propinas)
drop policy if exists domiciliarios_select_staff on public.domiciliarios;
create policy domiciliarios_select_staff
on public.domiciliarios
for select
to authenticated
using (public.es_staff(auth.uid()));