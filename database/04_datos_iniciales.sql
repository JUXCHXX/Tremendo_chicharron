-- ============================================================================
-- TREMENDO CHICHARRÓN — 04. DATOS INICIALES (carta completa)
-- Ejecutar DESPUÉS de 03_cron_y_funciones.sql.
-- ============================================================================

insert into public.configuracion (id, negocio_abierto) values (true, true)
on conflict (id) do nothing;

-- ── Categorías ──────────────────────────────────────────────────────────────
insert into public.categorias (nombre, orden, modelo_3d_url) values
  ('Desayunos', 1, '/desayunos-tremendo-chicharron.glb'),
  ('Almuerzos', 2, '/almuerzos-paella-chicharron.glb'),
  ('Para Picar / Tardear', 3, '/picar-tardear-chicharron.glb'),
  ('Bebidas', 4, null)
on conflict do nothing;

-- ── Productos ───────────────────────────────────────────────────────────────
with c as (select id, nombre from public.categorias)
insert into public.productos
  (categoria_id, nombre, descripcion, precio, por_persona, destacado_3d, modelo_3d_url, combo_gratis, orden)
values
  -- Desayunos
  ((select id from c where nombre='Desayunos'), 'Tremendo Chorizo', '2 chorizos de cerdo artesanales, arepa, papa salada, plátano maduro horneado, tomate, limón, guacamole y barbecue.', 18000, false, false, null, false, 1),
  ((select id from c where nombre='Desayunos'), 'Tremendos Huevos al Gusto', 'Huevos al gusto, cebolla, tomate, arepa y chocolate caliente.', 16000, false, false, null, false, 2),
  ((select id from c where nombre='Desayunos'), 'Tremendo Calentado', 'Arroz con huevo, con o sin vegetales, arepa o pan, opción chorizo o chicharrón, chocolate o aguapanela.', 20000, false, false, null, false, 3),
  ((select id from c where nombre='Desayunos'), 'Tremendo Calentado Paisa', 'Fríjoles, arroz, cebolla, arepa al carbón, huevos al gusto, chorizo o chicharrón, chocolate espeso o aguado.', 22000, false, false, null, false, 4),
  ((select id from c where nombre='Desayunos'), 'Tremendo Calentado Criollo', 'Arroz, papa, carne desmechada, arepa al carbón, huevo blando, chorizo o chicharrón, chocolate espeso o aguado.', 22000, false, false, null, false, 5),
  ((select id from c where nombre='Desayunos'), 'Tremendas Migas', 'Migas con arepa remojada en leche, vegetales frescos, especias, huevos, sándwich de jamón y chocolate.', 24000, false, false, null, false, 6),
  ((select id from c where nombre='Desayunos'), 'Tremendo Calentado Sabanero', 'Papas sabaneras fritas, cebolla, tomate, chorizo artesanal, 2 huevos de yema blanda, pan o arepa y chocolate.', 22000, false, false, null, false, 7),
  ((select id from c where nombre='Desayunos'), 'Tremendo Chicharrón (300g)', 'Arepa, papa salada, plátano maduro, limón, guacamole y barbecue.', 34000, false, true, '/desayunos-tremendo-chicharron.glb', false, 8),
  ((select id from c where nombre='Desayunos'), 'Tremenda Picada de Chicharrón', 'Chicharrón crocante, chorizos, papa salada, plátano maduro, arepa, limón y guacamole.', null, true, false, null, false, 9),
  ((select id from c where nombre='Desayunos'), 'Tremendo Ceviche de Chicharrón', 'Chicharrón crocante, guacamole, leche de tigre, pico de gallo y nachos mexicanos. (Precio por definir)', null, false, false, null, false, 10),
  -- Almuerzos
  ((select id from c where nombre='Almuerzos'), 'Tremendo Chicharrón (300g)', 'Arepa, papa salada, plátano maduro, limón, guacamole y barbecue.', 34000, false, false, null, false, 1),
  ((select id from c where nombre='Almuerzos'), 'Tremenda Paella de Chicharrón', 'Fusión de paella española con chicharrón colombiano y chorizo artesanal, arroz de alta calidad, vegetales, cebolla morada y casco de limón.', 34000, false, true, '/almuerzos-paella-chicharron.glb', false, 2),
  ((select id from c where nombre='Almuerzos'), 'Tremenda Picada de Chicharrón', 'Chicharrón crocante, chorizo, papa salada, plátano maduro, arepa, limón y guacamole.', null, true, false, null, false, 3),
  ((select id from c where nombre='Almuerzos'), 'Tremendas Albóndigas de Chicharrón', '3 albóndigas de 100g en bondiola de cerdo, rostizadas con chicharrón, papa, arepa, maduro, guacamole y barbecue.', 26000, false, false, null, false, 4),
  ((select id from c where nombre='Almuerzos'), 'Tremendo Combo Montañero', 'Frijoles a leña, arroz, chicharrón, chorizo, plátano maduro, aguacate + mazamorra michelada incluida.', 30000, false, false, null, false, 5),
  ((select id from c where nombre='Almuerzos'), 'Tremendo Combo Bowl Cafetero', 'Arroz especiado, papas sabaneras, carne desmechada, chicharrón, plátano maduro, aguacate + mazamorra michelada incluida.', 30000, false, false, null, false, 6),
  ((select id from c where nombre='Almuerzos'), 'Tremendo Bowl del Cafetal (sencillo)', 'Arroz especiado, papas sabaneras, carne desmechada, chicharrón, plátano maduro y aguacate. Sin mazamorra michelada.', 22000, false, false, null, false, 7),
  ((select id from c where nombre='Almuerzos'), 'Tremendo Bowl Montañero (sencillo)', 'Frijol a leña, arroz, chorizo, plátano maduro, aguacate en juliana y chicharrón. Sin mazamorra michelada.', 22000, false, false, null, false, 8),
  -- Para Picar / Tardear
  ((select id from c where nombre='Para Picar / Tardear'), 'Tremendo Chuzarrón', 'Chicharrón crocante con chorizo artesanal, arepa, papa salada, plátano maduro, limón y guacamole casero.', 22000, false, false, null, false, 1),
  ((select id from c where nombre='Para Picar / Tardear'), 'Hamburguesa de Chicharrón', 'Chicharrón, lechuga, tomate, cebolla caramelizada, patacón horneado con quesillo, guacamole y pan artesanal.', 25000, false, false, null, true, 2),
  ((select id from c where nombre='Para Picar / Tardear'), 'Tremenda Picada de Chicharrón', 'Chicharrón crocante, chorizo, papa salada, plátano maduro, arepa, limón y guacamole.', null, true, true, '/picar-tardear-chicharron.glb', false, 3),
  ((select id from c where nombre='Para Picar / Tardear'), 'Tremendo Ceviche de Chicharrón', 'Chicharrón crocante, guacamole, leche de tigre, pico de gallo y nachos mexicanos.', 34000, false, false, null, false, 4),
  ((select id from c where nombre='Para Picar / Tardear'), 'Tremenda Mazamorra Michelada', 'Maíz pelado a leña, toque michelado, arequipe, panela rallada y porción extra de leche.', 15000, false, false, null, false, 5),
  -- Bebidas
  ((select id from c where nombre='Bebidas'), 'Gaseosa Postobón', 'Botella personal, sabores surtidos.', 6000, false, false, null, false, 1),
  ((select id from c where nombre='Bebidas'), 'Agua saborizada', 'Botella personal.', 6000, false, false, null, false, 2),
  ((select id from c where nombre='Bebidas'), 'Limonada natural', 'Preparada al momento.', 10000, false, false, null, false, 3),
  ((select id from c where nombre='Bebidas'), 'Limonada saborizada', 'Cereza o yerbabuena.', 10000, false, false, null, false, 4);

-- ── Plato destacado 3D por categoría ────────────────────────────────────────
update public.categorias c
   set plato_destacado_id = p.id
  from public.productos p
 where p.categoria_id = c.id and p.destacado_3d = true;

-- ── Variantes de precio de la Picada (por número de personas) ───────────────
insert into public.variantes_precio (producto_id, cantidad_personas, precio)
select p.id, v.personas, v.precio
  from public.productos p
 cross join (values (1,34000),(2,60000),(3,86000),(4,120000),(5,150500),(6,175000),(8,230000),(10,295000))
       as v(personas, precio)
 where p.nombre = 'Tremenda Picada de Chicharrón'
on conflict (producto_id, cantidad_personas) do nothing;

-- ── Promoción destacada ─────────────────────────────────────────────────────
insert into public.promociones (titulo, descripcion, imagen_url, tipo_vigencia, activa)
values (
  'Día del Padre — Desayuno Sorpresa',
  'Escoge cualquier desayuno de la carta y lo entregamos en caja especial con moño, tarjeta, serpentina y dulces por dentro.',
  '/logo-tremendochicharron.jpeg',
  'por_fecha',
  true
)
on conflict do nothing;

-- ── Staff (ejecutar luego de crear los usuarios en Auth > Users) ────────────
-- insert into public.usuarios (user_id, rol, nombre)
-- values ('UUID-DEL-DUEÑO', 'superadmin', 'Don Germán'),
--        ('UUID-DE-LA-CAJERA', 'admin', 'Cajera');