-- =============================================================================
-- 0006 — Largo máximo de la nota de un movimiento de stock (Fase 7)
--
-- El panel deja escribir una nota en cada movimiento manual (reposición, ajuste,
-- dañado). La columna no tenía límite, como la descripción antes de 0005. Las notas
-- del sistema (número de pedido, "Cancelación FAL-…") son cortas. Mismo valor que
-- LIMITS.stockNote en src/lib/forms/limits.ts.
-- Antes de aplicarla en la nube: ninguna nota puede pasar de 200 caracteres
-- (si alguna pasa, el `add constraint` falla y no cambia nada).
-- Tests: supabase/tests/schema.test.cjs → [17].
-- =============================================================================

alter table public.stock_movements
  add constraint stock_movements_note_length
  check (note is null or char_length(note) <= 200);
