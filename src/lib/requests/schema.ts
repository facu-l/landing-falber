import { z } from "zod";
import { firstFieldErrors } from "@/lib/forms/field-errors";
import { fullNameField, optionalText, whatsappField } from "@/lib/forms/fields";
import { LIMITS } from "@/lib/forms/limits";

/*
 * Validación de /encargos. Corre en la Server Action (la frontera de confianza).
 * Repite las reglas de create_perfume_request solo para dar errores por campo y en
 * castellano; la base las vuelve a validar.
 */

const requestSchema = z.object({
  fullName: fullNameField,
  whatsapp: whatsappField,
  perfumeName: z
    .string()
    .trim()
    .min(2, "Escribí el nombre del perfume.")
    .max(LIMITS.perfumeName, `El nombre del perfume puede tener hasta ${LIMITS.perfumeName} caracteres.`),
  brand: optionalText(LIMITS.brand, `La marca puede tener hasta ${LIMITS.brand} caracteres.`),
  presentation: optionalText(LIMITS.presentation, `La presentación puede tener hasta ${LIMITS.presentation} caracteres.`),
  note: optionalText(LIMITS.note, `La aclaración puede tener hasta ${LIMITS.note} caracteres.`),
  // Solo cuando el encargo sale de un producto del catálogo (?producto=<slug>).
  variantId: z
    .union([z.literal(""), z.uuid()], { error: "Elegí una de las presentaciones." })
    .transform((value) => value || null),
});

export type RequestData = z.output<typeof requestSchema>;
export type RequestField = keyof z.input<typeof requestSchema>;
export type RequestFieldErrors = Partial<Record<RequestField, string>>;

export type RequestParseResult =
  | { success: true; data: RequestData }
  | { success: false; fieldErrors: RequestFieldErrors };

// Opcionales: un input que no se renderiza (ej. variantId en un encargo libre) no llega en el FormData.
const OPTIONAL_FIELDS = { brand: "", presentation: "", note: "", variantId: "" };

export function parseRequest(rawInput: Record<string, unknown>): RequestParseResult {
  const result = requestSchema.safeParse({ ...OPTIONAL_FIELDS, ...rawInput });
  if (result.success) return { success: true, data: result.data };

  return { success: false, fieldErrors: firstFieldErrors<RequestField>(result.error.issues) };
}
