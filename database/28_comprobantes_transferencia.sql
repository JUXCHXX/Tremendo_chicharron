-- Comprobantes de transferencia y verificación por Caja.
do $$ begin
  alter type public.estado_pedido add value 'pago_rechazado';
exception when duplicate_object then null; end $$;

alter table public.pedidos
  add column if not exists comprobante_pago_url text,
  add column if not exists motivo_rechazo_pago text;

-- El cliente solo puede asociar una URL a su propia comanda y únicamente
-- mientras espera el pago (la validación también evita cambiar otro estado).
create or replace function public.registrar_comprobante_pago(
  p_pedido_id uuid,
  p_telefono text,
  p_comprobante_url text
)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare v_pedido public.pedidos;
begin
  update public.pedidos
     set comprobante_pago_url = p_comprobante_url,
         motivo_rechazo_pago = null,
         estado = 'pendiente_pago'
   where id = p_pedido_id
     and cliente_telefono = p_telefono
     and medio_pago = 'transferencia'
     and estado in ('pendiente_confirmacion_cajera', 'pendiente_pago', 'pago_rechazado')
   returning * into v_pedido;
  if not found then
    raise exception 'No se pudo registrar el comprobante para este pedido';
  end if;
  return v_pedido;
end $$;

grant execute on function public.registrar_comprobante_pago(uuid, text, text) to anon, authenticated;

-- Permite que la app cree el bucket/políticas desde el Dashboard de Supabase.
-- Si el bucket ya existe, estas sentencias son idempotentes.
insert into storage.buckets (id, name, public)
values ('menu-imagenes', 'menu-imagenes', true)
on conflict (id) do update set public = true;

drop policy if exists comprobantes_insert_publico on storage.objects;
create policy comprobantes_insert_publico on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'menu-imagenes' and (storage.foldername(name))[1] = 'comprobantes');

drop policy if exists comprobantes_select_publico on storage.objects;
create policy comprobantes_select_publico on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu-imagenes' and (storage.foldername(name))[1] = 'comprobantes');
