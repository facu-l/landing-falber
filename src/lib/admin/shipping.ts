import type { OrderForTransition, OrderStatus } from "./order-transitions";

/** Estados en los que el costo de envío ya no cambia (guard_shipping_cost en 0001). */
const SHIPPING_COST_LOCKED: readonly OrderStatus[] = ["shipped", "completed", "cancelled"];

/**
 * Copia de public.guard_shipping_cost, solo para mostrar u ocultar el campo en el admin.
 * La base decide: si se desfasa, rechaza con SHIPPING_COST_PICKUP o SHIPPING_COST_LOCKED.
 */
export function canSetShippingCost(order: Pick<OrderForTransition, "status" | "delivery_method">): boolean {
  return order.delivery_method === "delivery" && !SHIPPING_COST_LOCKED.includes(order.status);
}
