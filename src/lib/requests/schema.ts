import { z } from "zod";
import { fullNameField, optionalText, whatsappField } from "@/lib/forms/fields";

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
    .max(120, "El nombre del perfume puede tener hasta 120 caracteres."),
  brand: optionalText(60, "La marca puede tener hasta 60 caracteres."),
  presentation: optionalText(60, "La presentación puede tener hasta 60 caracteres."),
  note: optionalText(100, "La aclaración puede tener hasta 100 caracteres."),
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

  // Un mensaje por campo (el primero): el formulario muestra uno debajo de cada input.
  const fieldErrors: RequestFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as RequestField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { success: false, fieldErrors };
}
