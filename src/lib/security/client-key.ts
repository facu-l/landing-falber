import "server-only";
import { createHmac } from "node:crypto";

/*
 * Clave anónima del cliente para el límite de pedidos por IP (p_client_key).
 * Nunca se guarda la IP en crudo: se guarda un HMAC-SHA256 con IP_HASH_SECRET.
 */

/**
 * IP del cliente.
 * - x-nf-client-connection-ip: la pone Netlify con la IP real de la conexión y
 *   pisa la que mande el cliente. Es la única confiable en producción.
 * - x-forwarded-for: solo como respaldo en local y CI. En producción no se usa
 *   sola porque el cliente la puede inventar y saltear el límite.
 * Sin ninguna, todos comparten la clave "unknown" (el límite es más estricto, no más laxo).
 */
export function clientIp(headers: Headers): string {
  const netlify = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

const MIN_SECRET_LENGTH = 32;

/**
 * HMAC y no sha256(ip + secreto): es la construcción estándar para un hash con
 * clave. Sin un secreto largo, el hash de una IPv4 se revierte probando las
 * 4.300 millones de IPs posibles en minutos.
 */
export function hashClientKey(ip: string, secret: string): string {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `IP_HASH_SECRET tiene que tener al menos ${MIN_SECRET_LENGTH} caracteres. Generá uno con el comando de .env.example.`,
    );
  }
  return createHmac("sha256", secret).update(ip).digest("hex");
}
