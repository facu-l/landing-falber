import type { OrderForTransition, OrderStatus } from "./order-transitions";
import { parseWholePesos } from "./pesos";

/**
 * Tope del formulario: frena un cero de más (la base solo pide >= 0). No va en LIMITS:
 * eso son largos de texto; esto es un monto.
 */
export const SHIPPING_COST_MAX = 1_000_000;

export const SHIPPING_COST_ERRORS = {
  format: "Escribí el costo en pesos, sin centavos (ej. 4500 o 4.500).",
  tooHigh: "Ese costo parece demasiado alto. Revisalo.",
} as const;

/** "" = a coordinar (null). Devuelve el monto o el error para mostrar debajo del campo. */
export function parseShippingCost(raw: string): { success: true; value: number | null } | { success: false; error: string } {
  const parsed = parseWholePesos(raw, SHIPPING_COST_MAX);
  if (!parsed.success) return { success: false, error: SHIPPING_COST_ERRORS[parsed.reason] };
  return parsed;
}

/** Estados en los que el costo de envío ya no cambia (guard_shipping_cost en 0001). */
const SHIPPING_COST_LOCKED: readonly OrderStatus[] = ["shipped", "completed", "cancelled"];

/**
 * Copia de public.guard_shipping_cost, solo para mostrar u ocultar el campo en el admin.
 * La base decide: si se desfasa, rechaza con SHIPPING_COST_PICKUP o SHIPPING_COST_LOCKED.
 */
export function canSetShippingCost(order: Pick<OrderForTransition, "status" | "delivery_method">): boolean {
  return order.delivery_method === "delivery" && !SHIPPING_COST_LOCKED.includes(order.status);
}
