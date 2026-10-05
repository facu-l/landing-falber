type ClassValue = string | false | null | undefined;

/**
 * Une clases condicionales: cn("a", cond && "b", undefined) → "a b".
 *
 * No resuelve conflictos (a propósito no usamos tailwind-merge: confunde
 * nuestras utilidades text-label/text-body con colores y las borra).
 * Regla: el className que recibe un componente es para layout (margin,
 * width, grid), no para pisar sus colores o tipografía.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
