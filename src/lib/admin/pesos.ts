/*
 * Montos en pesos enteros que escribe el admin: costo de envío, estimados y precio de
 * una presentación. Cada formulario pone su tope y sus mensajes; esto solo lee el número.
 */

// "4500", "4.500" (punto de miles), con o sin "$".
const WHOLE_PESOS = /^\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)$/;

export type WholePesosResult = { success: true; value: number | null } | { success: false; reason: "format" | "tooHigh" };

/** "" = null: cada formulario decide si un monto vacío vale. `max` es inclusivo. */
export function parseWholePesos(raw: string, max: number): WholePesosResult {
  const text = raw.trim();
  if (!text) return { success: true, value: null };

  const match = WHOLE_PESOS.exec(text);
  if (!match) return { success: false, reason: "format" };

  const value = Number(match[1].replaceAll(".", ""));
  if (value > max) return { success: false, reason: "tooHigh" };
  return { success: true, value };
}
