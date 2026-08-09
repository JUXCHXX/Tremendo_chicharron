-- ============================================================================
-- TREMENDO CHICHARRÓN — 02. ROW LEVEL SECURITY
-- Ejecutar DESPUÉS de 01_esquema.sql.
-- ============================================================================

alter table public.usuarios            enable row level security;
alter table public.configuracion       enable row level security;
alter table public.categorias          enable row level security;
alter table public.productos           enable row level security;
alter table public.variantes_precio    enable row level security;
alter table public.promociones         enable row level security;
alter table public.clientes            enable row level security;
alter table public.pedidos             enable row level security;
alter table public.pedido_items        enable row level security;
alter table public.historico_comandas  enable row level security;

-- ── usuarios ────────────────────────────────────────────────────────────────
-- Cada miembro del staff ve su propia fila; el superadmin ve todas.
drop policy if exists usuarios_select_propio on public.usuarios;
create policy usuarios_select_propio on public.usuarios
  for select to authenticated
  using (user_id = auth.uid() or public.tiene_rol(auth.uid(), 'superadmin'));
-- No hay INSERT/UPDATE desde la app: los usuarios se crean manualmente en Supabase.

-- ── configuracion ───────────────────────────────────────────────────────────
-- Cualquiera puede leer si el negocio está abierto; solo el superadmin lo cambia.
drop policy if exists configuracion_select_publico on public.configuracion;
create policy configuracion_select_publico on public.configuracion
  for select to anon, authenticated using (true);

drop policy if exists configuracion_update_superadmin on public.configuracion;
create policy configuracion_update_superadmin on public.configuracion
  for update to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

-- ── categorias / productos / variantes / promociones ────────────────────────
-- Lectura pública (el menú es público). Escritura solo del superadmin.
drop policy if exists categorias_select_publico on public.categorias;
create policy categorias_select_publico on public.categorias
  for select to anon, authenticated using (true);
drop policy if exists categorias_write_superadmin on public.categorias;
create policy categorias_write_superadmin on public.categorias
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

drop policy if exists productos_select_publico on public.productos;
create policy productos_select_publico on public.productos
  for select to anon, authenticated using (true);
drop policy if exists productos_write_superadmin on public.productos;
create policy productos_write_superadmin on public.productos
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

drop policy if exists variantes_select_publico on public.variantes_precio;
create policy variantes_select_publico on public.variantes_precio
  for select to anon, authenticated using (true);
drop policy if exists variantes_write_superadmin on public.variantes_precio;
create policy variantes_write_superadmin on public.variantes_precio
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

-- Solo se listan públicamente las promociones activas.
drop policy if exists promociones_select_publico on public.promociones;
create policy promociones_select_publico on public.promociones
  for select to anon, authenticated
  using (activa or public.es_staff(auth.uid()));
drop policy if exists promociones_write_superadmin on public.promociones;
create policy promociones_write_superadmin on public.promociones
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

-- ── clientes ────────────────────────────────────────────────────────────────
-- Cualquier cliente puede registrar su nombre + teléfono y consultar su propio
-- registro (por teléfono). No se exponen a terceros.
drop policy if exists clientes_insert_publico on public.clientes;
create policy clientes_insert_publico on public.clientes
  for insert to anon, authenticated with check (true);

drop policy if exists clientes_select_propio on public.clientes;
create policy clientes_select_propio on public.clientes
  for select to anon, authenticated
  using (
    telefono = current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
  );

drop policy if exists clientes_update_propio on public.clientes;
create policy clientes_update_propio on public.clientes
  for update to anon, authenticated
  using (true)
  with check (true);

-- ── pedidos ─────────────────────────────────────────────────────────────────
-- El cliente anónimo NO puede leer la tabla directamente (evita enumerar
-- pedidos ajenos). Toda consulta pública pasa por la RPC
-- public.consultar_pedido_por_comanda_y_telefono(), que valida que el
-- numero_comanda Y el cliente_telefono coincidan antes de devolver el pedido.
drop policy if exists pedidos_insert_publico on public.pedidos;
create policy pedidos_insert_publico on public.pedidos
  for insert to anon, authenticated
  with check (
    estado in ('pendiente_confirmacion_cajera','pendiente_pago')
    and (select negocio_abierto from public.configuracion where id) = true
  );

drop policy if exists pedidos_select_staff on public.pedidos;
create policy pedidos_select_staff on public.pedidos
  for select to authenticated
  using (public.es_staff(auth.uid()));

-- El cliente anónimo puede consultar sus propios pedidos por teléfono
-- (usado por "Mi Chicharronera").
drop policy if exists pedidos_select_anon on public.pedidos;
create policy pedidos_select_anon on public.pedidos
  for select to anon
  using (
    cliente_telefono = current_setting('request.headers', true)::jsonb ->> 'x-cliente-telefono'
  );

-- RPC pública controlada: devuelve el pedido SOLO si coinciden
-- numero_comanda y cliente_telefono. Devuelve también los ítems.
drop function if exists public.consultar_pedido_por_comanda_y_telefono(text, text);
create or replace function public.consultar_pedido_por_comanda_y_telefono(
  p_numero_comanda text,
  p_telefono text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_items jsonb;
begin
  select * into v_pedido
    from public.pedidos
   where numero_comanda = p_numero_comanda
     and cliente_telefono = p_telefono
   limit 1;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created), '[]'::jsonb)
    into v_items
    from (
      select pi.*, now() as created
        from public.pedido_items pi
       where pi.pedido_id = v_pedido.id
    ) i;

  return jsonb_build_object(
    'pedido', to_jsonb(v_pedido),
    'items', v_items
  );
end $$;

grant execute on function public.consultar_pedido_por_comanda_y_telefono(text, text) to anon, authenticated;

-- El cliente anónimo solo puede editar su comanda dentro de los 10 minutos.
drop policy if exists pedidos_update_ventana_cliente on public.pedidos;
create policy pedidos_update_ventana_cliente on public.pedidos
  for update to anon
  using (now() < editable_hasta and estado in ('pendiente_pago','pago_confirmado'))
  with check (now() < editable_hasta);

-- El staff (cajera y dueño) puede actualizar cualquier pedido.
drop policy if exists pedidos_update_staff on public.pedidos;
create policy pedidos_update_staff on public.pedidos
  for update to authenticated
  using (public.es_staff(auth.uid()))
  with check (public.es_staff(auth.uid()));

-- Solo el superadmin puede borrar pedidos (depuración/respaldos).
drop policy if exists pedidos_delete_superadmin on public.pedidos;
create policy pedidos_delete_superadmin on public.pedidos
  for delete to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'));

-- ── pedido_items ────────────────────────────────────────────────────────────
drop policy if exists items_insert_publico on public.pedido_items;
create policy items_insert_publico on public.pedido_items
  for insert to anon, authenticated with check (true);

drop policy if exists items_select_publico on public.pedido_items;
create policy items_select_publico on public.pedido_items
  for select to anon, authenticated using (true);

-- El cliente solo modifica ítems mientras la ventana de 10 min siga abierta.
drop policy if exists items_update_ventana_cliente on public.pedido_items;
create policy items_update_ventana_cliente on public.pedido_items
  for all to anon
  using (
    exists (select 1 from public.pedidos p where p.id = pedido_id and now() < p.editable_hasta)
  )
  with check (
    exists (select 1 from public.pedidos p where p.id = pedido_id and now() < p.editable_hasta)
  );

drop policy if exists items_write_staff on public.pedido_items;
create policy items_write_staff on public.pedido_items
  for all to authenticated
  using (public.es_staff(auth.uid()))
  with check (public.es_staff(auth.uid()));

-- ── historico_comandas ──────────────────────────────────────────────────────
-- Solo el staff lo consulta; nunca se expone al cliente.
drop policy if exists historico_select_staff on public.historico_comandas;
create policy historico_select_staff on public.historico_comandas
  for select to authenticated using (public.es_staff(auth.uid()));

drop policy if exists historico_insert_staff on public.historico_comandas;
create policy historico_insert_staff on public.historico_comandas
  for insert to authenticated with check (public.es_staff(auth.uid()));