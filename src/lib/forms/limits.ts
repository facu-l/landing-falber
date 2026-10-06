/*
 * Largos máximos de los formularios de la tienda: los usan los schemas de zod (.max)
 * y los inputs (maxLength). Un solo lugar para que no se desfasen.
 *
 * Los de nombre, aclaración, perfume, marca y presentación son los de la base
 * (supabase/migrations/0001_initial_schema.sql); los de envío existen solo acá
 * (TODOS.md → Checkout).
 *
 * Sin zod a propósito: los formularios son componentes de cliente y no tienen que
 * cargar los schemas en el navegador.
 */
export const LIMITS = {
  fullName: 80,
  note: 100,
  // Checkout
  address: 120,
  city: 60,
  postalCode: 10,
  reference: 120,
  // Encargos
  perfumeName: 120,
  brand: 60,
  presentation: 60,
} as const;
