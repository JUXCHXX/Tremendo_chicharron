-- Activa el restaurante para el checkout y el asistente Don Velto.
-- `configuracion` usa una sola fila identificada por id = true.

insert into public.configuracion (id, negocio_abierto)
values (true, true)
on conflict (id) do update
set negocio_abierto = true,
    actualizado_en = now();

select id, negocio_abierto
from public.configuracion
where id = true;