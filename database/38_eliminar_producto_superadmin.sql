-- TREMENDO CHICHARRON - Retiro de productos conservando comandas historicas

alter table public.productos
  add column if not exists eliminado boolean not null default false;

create or replace function public.eliminar_producto_superadmin(p_producto_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.tiene_rol(auth.uid(), 'superadmin') then
    raise exception 'No tienes permisos para eliminar productos';
  end if;

  if not exists (select 1 from public.productos where id = p_producto_id and not eliminado) then
    raise exception 'El producto no existe';
  end if;

  -- Evita que una categoria quede apuntando a un producto inexistente.
  update public.categorias
     set plato_destacado_id = null
   where plato_destacado_id = p_producto_id;

  -- Retiro lógico: evita romper triggers/históricos y lo saca del menú.
  update public.productos
     set eliminado = true,
         disponible = false
   where id = p_producto_id;
end;
$$;

revoke all on function public.eliminar_producto_superadmin(uuid) from public;
grant execute on function public.eliminar_producto_superadmin(uuid) to authenticated;