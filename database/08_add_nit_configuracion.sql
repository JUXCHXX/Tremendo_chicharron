-- ============================================================================
-- TREMENDO CHICHARRÓN — 08. AGREGAR NIT A CONFIGURACIÓN
--
-- Agrega una columna `nit` (text) a la tabla `configuracion` con el valor
-- por defecto del NIT de la empresa.
--
-- Ejecutar DESPUÉS de 01_esquema.sql (migración aislada).
-- ============================================================================

alter table public.configuracion
  add column if not exists nit text not null default '901.433.592-5';