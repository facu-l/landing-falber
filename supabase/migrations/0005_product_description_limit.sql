-- =============================================================================
-- 0005 — Largo máximo de la descripción de un producto (Fase 7)
--
-- Nombre y marca tienen límite desde 0001; la descripción no tenía ninguno. Un texto
-- pegado de más viajaría en cada carga del catálogo (una sola entrada cacheada con
-- todos los productos). Mismo valor que LIMITS.description en src/lib/forms/limits.ts.
-- Antes de aplicarla en la nube: ninguna descripción puede pasar de 1000 caracteres
-- (si alguna pasa, el `add constraint` falla y no cambia nada).
-- Tests: supabase/tests/schema.test.cjs → [16].
-- =============================================================================

alter table public.products
  add constraint products_description_length
  check (description is null or char_length(description) <= 1000);
