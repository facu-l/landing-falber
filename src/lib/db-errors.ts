/*
 * Errores de las RPC → mensajes para el cliente (decisión 4).
 * La base levanta `message` = código estable y, a veces, `detail` = el dato con
 * problemas (ej. un variant_id). Cada RPC tiene su propio mapa de mensajes
 * (order-errors.ts, requests/errors.ts); esta función es la traducción común.
 */

/** Forma mínima de un error de supabase-js (PostgrestError). */
export type DbError = { message?: string; details?: string | null; code?: string };

export type MappedDbError<Code extends string> = {
  code: Code | "UNKNOWN";
  message: string;
  detail: string | null;
  /** false: no es un código nuestro (constraint, red, bug). Hay que loguearlo. */
  known: boolean;
};

export function mapDbError<Code extends string>(
  error: DbError,
  messages: Readonly<Record<Code, string>>,
  fallback: string,
): MappedDbError<Code> {
  const code = error.message;
  if (!code || !Object.hasOwn(messages, code)) {
    return { code: "UNKNOWN", message: fallback, detail: null, known: false };
  }
  const known = code as Code;
  return { code: known, message: messages[known], detail: error.details ?? null, known: true };
}

/**
 * Lo que se loguea de un error desconocido de la base: código y mensaje.
 * Nunca `details`: si falla un check, Postgres pone ahí la fila entera ("Failing row
 * contains (...)") con nombre, WhatsApp o dirección del cliente, y terminaría en los
 * logs de Netlify (Ley 25.326).
 */
export function loggableDbError(error: DbError): Pick<DbError, "code" | "message"> {
  return { code: error.code, message: error.message };
}
