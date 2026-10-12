/*
 * Largos máximos de los formularios de la tienda: los usan los schemas de zod (.max)
 * y los inputs (maxLength). Un solo lugar para que no se desfasen.
 *
 * Son los mismos de la base (supabase/migrations/0001_initial_schema.sql): si cambia
 * uno, cambia en los dos lados. schema.test.cjs prueba los de la base.
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
  // Admin de catálogo (0005)
  description: 1000,
  // Admin de catálogo (0006)
  stockNote: 200,
} as const;
