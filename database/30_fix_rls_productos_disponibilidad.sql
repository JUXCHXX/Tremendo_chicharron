-- Corrección explícita para el toggle Sold Out del panel de Super Admin.
-- La política general de escritura puede no existir en proyectos que aplicaron
-- migraciones parcialmente; esta política deja documentado y garantizado el
-- permiso puntual que necesita el frontend.
drop policy if exists productos_update_superadmin on public.productos;
create policy productos_update_superadmin on public.productos
  for update to authenticated
  using (public.tiene_rol(auth.uid(), 'superadmin'))
  with check (public.tiene_rol(auth.uid(), 'superadmin'));
