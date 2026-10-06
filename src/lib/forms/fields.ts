import { z } from "zod";
import { normalizeArgentineWhatsApp } from "@/lib/phone";
import { LIMITS } from "./limits";

/*
 * Campos de zod que comparten los formularios de la tienda (checkout y encargos).
 */

export const WHATSAPP_ERROR = "Revisá el número: con código de área, sin 0 ni 15 (ej. 221 555 1234).";

/** WhatsApp argentino como lo escribe la gente → +549 + 10 dígitos (src/lib/phone.ts). */
export const whatsappField = z.string().transform((value, ctx) => {
  const normalized = normalizeArgentineWhatsApp(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: WHATSAPP_ERROR });
    return z.NEVER;
  }
  return normalized;
});

/** Nombre y apellido: los mismos límites que la base (2 a 80). */
export const fullNameField = z
  .string()
  .trim()
  .min(2, "Escribí tu nombre y apellido.")
  .max(LIMITS.fullName, `El nombre puede tener hasta ${LIMITS.fullName} caracteres.`);

/** Texto opcional con largo máximo; vacío → null. */
export const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => value || null);
