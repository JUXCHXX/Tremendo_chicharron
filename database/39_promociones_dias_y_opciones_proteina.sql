-- TREMENDO CHICHARRON - Vigencia por multiples dias y grupos de proteina

alter table public.promociones
  add column if not exists dias_semana int[] not null default '{}'::int[];

update public.promociones
set dias_semana = array[dia_semana]
where dia_semana is not null and cardinality(dias_semana) = 0;

alter table public.promociones
  drop constraint if exists promociones_dias_semana_check;

alter table public.promociones
  add constraint promociones_dias_semana_check
  check (dias_semana <@ array[0,1,2,3,4,5,6]);

alter table public.productos
  add column if not exists max_opciones_proteina int not null default 1;

alter table public.productos
  drop constraint if exists productos_max_opciones_proteina_check;

alter table public.productos
  add constraint productos_max_opciones_proteina_check
  check (max_opciones_proteina between 1 and 10);
