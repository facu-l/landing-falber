import { type DbError, mapDbError } from "@/lib/db-errors";

/*
 * Errores de create_perfume_request → mensajes para el cliente (decisión 4).
 * Mismo criterio que order-errors.ts: voz de la marca, sin signos de exclamación
 * y diciendo cómo seguir.
 */

const RELOAD = "Hubo un problema con tu encargo. Recargá la página y probá de nuevo.";

export const REQUEST_ERRORS = {
  // Datos del formulario (zod ya los valida: llegan solo si zod y la base no coinciden)
  INVALID_NAME: "Revisá tu nombre: tiene que tener entre 2 y 80 caracteres.",
  INVALID_WHATSAPP: "Revisá tu número de WhatsApp: con código de área, sin 0 ni 15.",
  INVALID_PERFUME_NAME: "Escribí el nombre del perfume: entre 2 y 120 caracteres.",
  INVALID_BRAND: "La marca puede tener hasta 60 caracteres.",
  INVALID_PRESENTATION: "La presentación puede tener hasta 60 caracteres.",
  NOTE_TOO_LONG: "La aclaración puede tener hasta 100 caracteres.",
  VARIANT_NOT_FOUND: "Ese perfume ya no está en el catálogo. Pedilo desde Encargos sin elegir un producto.",

  // Anti-abuso
  RATE_LIMITED: "Demasiados intentos. Probá de nuevo en un rato.",

  // Si aparece, es un bug nuestro (el servidor arma la clave), no del cliente
  INVALID_CLIENT_KEY: RELOAD,
} as const;

export type RequestErrorCode = keyof typeof REQUEST_ERRORS;

export const GENERIC_REQUEST_ERROR =
  "No pudimos registrar tu encargo. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

export type RequestError = {
  code: RequestErrorCode | "UNKNOWN";
  message: string;
  /** false: no es un código nuestro (constraint, red, bug). Hay que loguearlo. */
  known: boolean;
};

export function requestError(error: DbError): RequestError {
  const { code, message, known } = mapDbError(error, REQUEST_ERRORS, GENERIC_REQUEST_ERROR);
  return { code, message, known };
}
