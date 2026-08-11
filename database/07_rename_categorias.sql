-- ============================================================================
-- TREMENDO CHICHARRÓN — 07. RENAME CATEGORÍAS Y PLATOS DESTACADOS 3D
--
-- Renombra las categorías del menú y actualiza su plato destacado (y por lo
-- tanto su animación 3D) según los nuevos platos principales:
--
--   - "Desayunos"      → "Tremendo Calentado"
--       plato destacado: Tremendo Calentado Paisa
--       modelo 3D:      /desayunos-tremendo-calentado-paisa.glb
--
--   - "Almuerzos"      → "Tremendo Chicharrón"
--       plato destacado: Tremendo Bowl Montañero (sencillo)
--       modelo 3D:      /almuerzos-bowl-montanero.glb
--
--   - "Para Picar / Tardear" NO se toca (ya está bien configurada).
--
-- Ejecutar DESPUÉS de 02_rls.sql (migración aislada).
-- ============================================================================

-- ── 1. Actualizar nombres de categorías ──────────────────────────────────────
update public.categorias
   set nombre = 'Tremendo Calentado'
 where nombre = 'Desayunos';

update public.categorias
   set nombre = 'Tremendo Chicharrón'
 where nombre = 'Almuerzos';

-- ── 2. Actualizar plato_destacado_id y modelo_3d_url ────────────────────────
-- Categoría "Tremendo Calentado" (antes Desayunos) → Tremendo Calentado Paisa
update public.categorias c
   set plato_destacado_id = p.id,
       modelo_3d_url      = '/desayunos-tremendo-calentado-paisa.glb'
  from public.productos p
 where c.nombre = 'Tremendo Calentado'
   and p.categoria_id = c.id
   and p.nombre = 'Tremendo Calentado Paisa';

-- Categoría "Tremendo Chicharrón" (antes Almuerzos) → Tremendo Bowl Montañero (sencillo)
update public.categorias c
   set plato_destacado_id = p.id,
       modelo_3d_url      = '/almuerzos-bowl-montanero.glb'
  from public.productos p
 where c.nombre = 'Tremendo Chicharrón'
   and p.categoria_id = c.id
   and p.nombre = 'Tremendo Bowl Montañero (sencillo)';