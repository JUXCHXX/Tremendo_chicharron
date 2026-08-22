-- ============================================================================
-- TREMENDO CHICHARRÓN — 22. FIX REGISTRO DOMICILIARIO (RPC SECURITY DEFINER)
-- ----------------------------------------------------------------------------
-- El registro de un nuevo domiciliario falla por RLS al insertar en
-- `domiciliarios`. Además, Supabase Auth tiene la confirmación de email
-- habilitada, lo que impide el registro inmediato.
--
-- SOLUCIÓN:
--   1. Función RPC `registrar_domiciliario` (SECURITY DEFINER) que inserta
--      la fila en `domiciliarios` sin depender de las políticas RLS.
--   2. La función `es_domiciliario` ya existe y verifica el perfil activo.
-- ============================================================================

-- ── 1) FUNCIÓN RPC PARA REGISTRAR DOMICILIARIO ───────────────────────────────
-- SECURITY DEFINER: se ejecuta con permisos del owner (postgres), evitando
-- la recursión RLS. El usuario autenticado solo puede insertar su propia fila
-- (se valida p_user_id = auth.uid()).
create or replace function public.registrar_domiciliario(
  p_user_id uuid,
  p_nombre_completo text,
  p_correo text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validar que el usuario solo registre su propia fila
  if p_user_id <> auth.uid() then
    return false;
  end if;

  insert into public.domiciliarios (user_id, nombre_completo, correo)
  values (p_user_id, p_nombre_completo, p_correo);

  return true;
exception
  when unique_violation then
    -- Ya existe un perfil para este usuario (re-registro) → no es error
    return true;
  when others then
    return false;
end;
$$;

grant execute on function public.registrar_domiciliario(uuid, text, text) to authenticated;

-- ── 2) GARANTIZAR POLÍTICAS RLS BÁSICAS ──────────────────────────────────────
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