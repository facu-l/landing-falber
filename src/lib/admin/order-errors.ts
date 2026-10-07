import { type DbError, mapDbError } from "@/lib/db-errors";

/*
 * Errores de la base al cambiar un pedido desde el admin → mensajes (decisión 4).
 * La UI ya ofrece solo lo válido: estos llegan si el pedido cambió en el medio
 * (otra pestaña, la cancelación automática de pg_cron) o si las copias se desfasan.
 */

const RELOAD = "Recargá la página para ver el pedido actualizado.";

export const ADMIN_ORDER_ERRORS = {
  INVALID_STATUS_TRANSITION: `El pedido cambió de estado mientras lo mirabas. ${RELOAD}`,
  SHIPPING_COST_PICKUP: "Un pedido con retiro no lleva costo de envío.",
  SHIPPING_COST_LOCKED: `El pedido ya salió o está cerrado: el costo de envío no se puede cambiar. ${RELOAD}`,
} as const;

export const GENERIC_ADMIN_ORDER_ERROR = "No pudimos guardar el cambio. Probá de nuevo en unos segundos.";

export function adminOrderError(error: DbError) {
  return mapDbError(error, ADMIN_ORDER_ERRORS, GENERIC_ADMIN_ORDER_ERROR);
}
