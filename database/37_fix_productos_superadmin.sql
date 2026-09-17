-- TREMENDO CHICHARRON - Permisos de productos para el superadmin
-- Ejecutar en Supabase SQL Editor con un usuario propietario del proyecto.

alter table public.productos enable row level security;

drop policy if exists productos_write_superadmin on public.productos;
create policy productos_write_superadmin on public.productos
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

drop policy if exists productos_delete_superadmin on public.productos;
create policy productos_delete_superadmin on public.productos
  for delete to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'));

drop policy if exists productos_select_publico on public.productos;
create policy productos_select_publico on public.productos
  for select to anon, authenticated
  using (true);

-- Rellena las opciones de productos antiguos que aun no tenian configuracion.
update public.productos
set opciones_proteina = (
  select coalesce(jsonb_agg(initcap(ingrediente)), '[]'::jsonb)
  from (values
    ('chicharrón'), ('chorizo'), ('carne desmechada'), ('carne'),
    ('pollo'), ('huevo'), ('huevos'), ('aguacate'), ('guacamole'),
    ('plátano maduro'), ('arepa'), ('papa salada')
  ) as ingredientes(ingrediente)
  where lower(public.productos.descripcion) like '%' || ingredientes.ingrediente || '%'
)
where opciones_proteina = '[]'::jsonb;
