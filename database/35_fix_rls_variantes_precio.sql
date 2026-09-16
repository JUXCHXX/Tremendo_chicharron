-- Permite a Super Administración guardar precios por cantidad de personas.
-- La restricción UNIQUE (producto_id, cantidad_personas) ya existe y permite
-- el upsert usado por la pantalla de Super Administración.

alter table public.variantes_precio enable row level security;

drop policy if exists variantes_write_superadmin on public.variantes_precio;
create policy variantes_write_superadmin on public.variantes_precio
  for all to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));

grant insert, update, delete on public.variantes_precio to authenticated;