import type { z } from "zod";

/**
 * Errores de zod → un mensaje por campo (el primero): cada formulario muestra uno
 * debajo de su input. `existing` tiene prioridad: el checkout primero valida las
 * reglas entre campos y zod no las pisa.
 */
export function firstFieldErrors<Field extends string>(
  issues: readonly z.core.$ZodIssue[],
  existing: Partial<Record<Field, string>> = {},
): Partial<Record<Field, string>> {
  const fieldErrors = { ...existing };
  for (const issue of issues) {
    const field = issue.path[0] as Field | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}
