-- ============================================================================
-- TREMENDO CHICHARRÓN — 18. EDICIÓN DE PEDIDOS BLOQUEADA DESPUÉS DE COCINA
-- ----------------------------------------------------------------------------
-- Regla de negocio (punto 19):
--   El pedido puede editarse (agregar/quitar productos, cambiar cantidades,
--   modificar notas) por la cajera y por el cliente SOLO mientras el estado
--   sea anterior a 'en_cocina' (pendiente_confirmacion_cajera, pendiente_pago,
--   pago_confirmado). A partir de en_cocina, el pedido es de solo lectura.
--
-- Implementación:
--   1. RLS: pedidos_update_* e items_* reflejan la regla.
--   2. Triggers de validación (defensa en profundidad: aplican incluso a
--      escrituras con service_role o SQL directo).
--   3. RPC pública editar_pedido_con_items() para edición atómica y segura
--      desde el frontend (cliente anónimo y staff).
--   4. items_select_anon: el cliente anónimo puede leer items de SUS pedidos
--      (con header x-cliente-telefono) para que "Mi Chicharronera" muestre
--      el detalle completo.
-- ============================================================================

-- ── 1) RLS: pedidos ─────────────────────────────────────────────────────────
-- Cliente anónimo: solo edita SU PROPIO pedido (header x-cliente-telefono),
-- en estados previos a cocina y dentro de la ventana editable_hasta.
-- No cambia estados.
drop policy if exists pedidos_update_ventana_cliente on public.pedidos;
create policy pedidos_update_ventana_cliente on public.pedidos
  for update to anon
  using (
    cliente_telefono =
      current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
    and now() < editable_hasta
    and estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
  )
  with check (
    cliente_telefono =
      current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
    and now() < editable_hasta
    and estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
  );

-- Función SECURITY DEFINER para leer el estado actual de un pedido sin
-- recursión en las políticas RLS (evita "infinite recursion detected").
create or replace function public.estado_actual_pedido(p_pedido_id uuid)
returns public.estado_pedido
language sql
stable
security definer
set search_path = public
as $$
  select estado from public.pedidos where id = p_pedido_id
$$;

-- Staff: puede cambiar el estado SIEMPRE (incluye pasar a en_cocina y avanzar),
-- pero solo puede modificar el contenido (subtotal, total, domicilio, etc.)
-- si el estado ACTUAL es anterior a en_cocina.
drop policy if exists pedidos_update_staff on public.pedidos;
create policy pedidos_update_staff on public.pedidos
  for update to authenticated
  using (public.es_staff(auth.uid()))
  with check (
    public.es_staff(auth.uid())
    and (
      -- Cambio de estado: el estado nuevo difiere del actual → siempre permitido
      estado <> public.estado_actual_pedido(id)
      -- O el estado actual es anterior a en_cocina → edición de contenido permitida
      or public.estado_actual_pedido(id)
         in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  );

-- ── 2) RLS: pedido_items ────────────────────────────────────────────────────
-- SELECT: el staff lee todo; el cliente anónimo lee SOLO items de sus pedidos
-- (requiere header x-cliente-telefono, igual que pedidos_select_anon).
drop policy if exists items_select_staff on public.pedido_items;
create policy items_select_staff on public.pedido_items
  for select to authenticated
  using (public.es_staff(auth.uid()));

drop policy if exists items_select_anon on public.pedido_items;
create policy items_select_anon on public.pedido_items
  for select to anon
  using (
    exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.cliente_telefono =
             current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
    )
  );

-- Cliente anónimo: INSERT/UPDATE/DELETE solo sobre items de SU PROPIO pedido
-- (header x-cliente-telefono), en estados previos a cocina y dentro de la
-- ventana editable_hasta.
-- IMPORTANTE: se elimina items_insert_publico (migración 02) que permitía a
-- cualquier anónimo insertar items en pedidos ajenos sin restricción.
drop policy if exists items_insert_publico on public.pedido_items;
drop policy if exists items_update_ventana_cliente on public.pedido_items;
create policy items_update_ventana_cliente on public.pedido_items
  for all to anon
  using (
    exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.cliente_telefono =
             current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
         and now() < p.editable_hasta
         and p.estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  )
  with check (
    exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.cliente_telefono =
             current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
         and now() < p.editable_hasta
         and p.estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  );

-- Staff: escritura (INSERT/UPDATE/DELETE) solo si el pedido está en estados
-- previos a cocina. La lectura ya está cubierta por items_select_staff.
drop policy if exists items_write_staff on public.pedido_items;
create policy items_write_staff on public.pedido_items
  for insert to authenticated
  with check (
    public.es_staff(auth.uid())
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  );

drop policy if exists items_update_staff on public.pedido_items;
create policy items_update_staff on public.pedido_items
  for update to authenticated
  using (
    public.es_staff(auth.uid())
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  )
  with check (
    public.es_staff(auth.uid())
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  );

drop policy if exists items_delete_staff on public.pedido_items;
create policy items_delete_staff on public.pedido_items
  for delete to authenticated
  using (
    public.es_staff(auth.uid())
    and exists (
      select 1 from public.pedidos p
       where p.id = pedido_id
         and p.estado in ('pendiente_confirmacion_cajera','pendiente_pago','pago_confirmado')
    )
  );

-- ── 3) Triggers de validación (defensa en profundidad) ──────────────────────
-- Pedidos: si el estado actual es en_cocina o posterior, el contenido queda
-- congelado. Solo se permite cambiar el estado (y nada más).
-- También se congela el contenido en el MISMO UPDATE que pasa a en_cocina:
-- si el estado NUEVO es en_cocina o posterior, el contenido no puede cambiar.
create or replace function public.validar_edicion_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado in ('en_cocina','en_preparacion','en_camino','entregado','cancelado')
     or new.estado in ('en_cocina','en_preparacion','en_camino','entregado','cancelado') then
    if (
      new.subtotal <> old.subtotal
      or new.total <> old.total
      or new.valor_domicilio <> old.valor_domicilio
      or new.cliente_nombre <> old.cliente_nombre
      or new.cliente_telefono <> old.cliente_telefono
      or new.direccion_entrega <> old.direccion_entrega
      or new.medio_pago <> old.medio_pago
      or new.monto_efectivo_recibido is distinct from old.monto_efectivo_recibido
      or new.vuelto is distinct from old.vuelto
      or new.version <> old.version
      or new.editable_hasta <> old.editable_hasta
    ) then
      raise exception 'El pedido ya está en cocina o fue finalizado: su contenido no puede modificarse';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_validar_edicion_pedido on public.pedidos;
create trigger trg_validar_edicion_pedido
  before update on public.pedidos
  for each row execute function public.validar_edicion_pedido();

-- Items: cualquier escritura sobre items de un pedido en cocina o posterior
-- queda bloqueada (aplica también a service_role / SQL directo).
create or replace function public.validar_edicion_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.estado_pedido;
  v_pedido_id uuid;
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);
  select estado into v_estado from public.pedidos where id = v_pedido_id;
  if v_estado in ('en_cocina','en_preparacion','en_camino','entregado','cancelado') then
    raise exception 'El pedido ya está en cocina o fue finalizado: sus productos no pueden modificarse';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_validar_edicion_items on public.pedido_items;
create trigger trg_validar_edicion_items
  before insert or update or delete on public.pedido_items
  for each row execute function public.validar_edicion_items();

-- ── 4) RPC pública: edición atómica de pedido + items ───────────────────────
-- Valida permisos (staff o cliente dueño del pedido dentro de la ventana),
-- valida que el estado sea anterior a en_cocina, recalcula subtotal/total,
-- archiva la versión anterior (trigger) y reemplaza los items.
drop function if exists public.editar_pedido_con_items(uuid, jsonb, numeric);
create or replace function public.editar_pedido_con_items(
  p_pedido_id uuid,
  p_items jsonb,
  p_valor_domicilio numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_total numeric;
  v_es_staff boolean;
  v_es_cliente boolean;
begin
  select * into v_pedido from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  -- Permisos: staff autenticado, o cliente dueño del pedido dentro de la ventana.
  v_es_staff := public.es_staff(auth.uid());
  v_es_cliente := (
    v_pedido.cliente_telefono =
      current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
    and now() < v_pedido.editable_hasta
  );
  if not v_es_staff and not v_es_cliente then
    raise exception 'No tienes permiso para editar este pedido';
  end if;

  -- Regla de negocio: solo editable antes de en_cocina.
  if v_pedido.estado in ('en_cocina','en_preparacion','en_camino','entregado','cancelado') then
    raise exception 'El pedido ya está en cocina o fue finalizado y no puede editarse';
  end if;

  -- Validar items y calcular subtotal.
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items debe ser un arreglo JSON';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'cantidad') is null
       or (v_item->>'precio_unitario') is null
       or (v_item->>'nombre') is null then
      raise exception 'Cada item debe tener nombre, cantidad y precio_unitario';
    end if;
    v_subtotal := v_subtotal + (v_item->>'cantidad')::numeric * (v_item->>'precio_unitario')::numeric;
  end loop;

  v_total := v_subtotal + coalesce(p_valor_domicilio, v_pedido.valor_domicilio);

  -- Actualizar pedido (sube versión → el trigger archiva la anterior).
  update public.pedidos
     set subtotal = v_subtotal,
         total = v_total,
         valor_domicilio = coalesce(p_valor_domicilio, v_pedido.valor_domicilio),
         version = v_pedido.version + 1
   where id = p_pedido_id;

  -- Reemplazar items.
  delete from public.pedido_items where pedido_id = p_pedido_id;

  insert into public.pedido_items
    (pedido_id, producto_id, nombre_producto, cantidad, variante_personas, combo, notas, precio_unitario)
  select
    p_pedido_id,
    nullif(v_item->>'producto_id', '')::uuid,
    v_item->>'nombre',
    (v_item->>'cantidad')::int,
    nullif(v_item->>'variante_personas', '')::int,
    coalesce((v_item->>'combo')::boolean, false),
    coalesce(v_item->>'notas', ''),
    (v_item->>'precio_unitario')::numeric
  from jsonb_array_elements(p_items) v_item;

  return jsonb_build_object(
    'ok', true,
    'subtotal', v_subtotal,
    'valor_domicilio', coalesce(p_valor_domicilio, v_pedido.valor_domicilio),
    'total', v_total,
    'version', v_pedido.version + 1
  );
end $$;

grant execute on function public.editar_pedido_con_items(uuid, jsonb, numeric) to anon, authenticated;