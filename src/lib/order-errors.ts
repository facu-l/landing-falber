import { type DbError, mapDbError } from "./db-errors";

/*
 * Errores de create_order → mensajes para el cliente (decisión 4).
 * La base levanta `message` = código estable y, en los errores de stock,
 * `detail` = variant_id. Los mensajes respetan la voz de la marca: sin signos
 * de exclamación y diciendo cómo seguir.
 */

const RELOAD = "Hubo un problema con tu pedido. Recargá la página y probá de nuevo.";

export const ORDER_ERRORS = {
  // Datos del cliente (el formulario ya los valida: llegan solo si zod y la base no coinciden)
  INVALID_NAME: "Revisá tu nombre: tiene que tener entre 2 y 80 caracteres.",
  INVALID_WHATSAPP: "Revisá tu número de WhatsApp: con código de área, sin 0 ni 15.",
  INVALID_EMAIL: "Revisá tu email.",
  INVALID_PAYMENT_METHOD: "Elegí cómo vas a pagar.",
  INVALID_DELIVERY_METHOD: "Elegí cómo querés recibir tu pedido.",
  CASH_REQUIRES_PICKUP: "El pago en efectivo es solo para retiro en La Plata.",
  ADDRESS_REQUIRED: "Para envío a domicilio necesitamos dirección y ciudad.",
  NOTE_TOO_LONG: "La aclaración puede tener hasta 100 caracteres.",
  DELIVERY_DATA_TOO_LONG: "Revisá los datos de envío: alguno es demasiado largo.",

  // Carrito
  EMPTY_CART: "Tu carrito está vacío.",
  TOO_MANY_ITEMS: "Tu carrito tiene demasiados productos distintos. Sacá alguno para seguir.",
  INVALID_QUANTITY: "Podés llevar hasta 10 unidades de cada presentación.",
  VARIANT_UNAVAILABLE: "Uno de los productos ya no está disponible. Revisá tu carrito.",
  INSUFFICIENT_STOCK: "No queda stock suficiente de uno de los productos. Revisá tu carrito.",

  // Anti-abuso
  RATE_LIMITED: "Demasiados intentos. Probá de nuevo en un rato.",
  TOO_MANY_PENDING_ORDERS: "Ya tenés pedidos pendientes. Escribinos por WhatsApp y lo resolvemos.",

  // Si aparecen, es un bug nuestro (el servidor arma estos datos), no del cliente
  MISSING_REQUEST_ID: RELOAD,
  INVALID_CLIENT_KEY: RELOAD,
  INVALID_ITEM: RELOAD,
} as const;

export type OrderErrorCode = keyof typeof ORDER_ERRORS;

export const GENERIC_ORDER_ERROR =
  "No pudimos registrar tu pedido. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

// Errores en los que `detail` es el variant_id del producto con problemas.
const VARIANT_DETAIL_CODES: ReadonlySet<OrderErrorCode> = new Set([
  "INSUFFICIENT_STOCK",
  "VARIANT_UNAVAILABLE",
  "INVALID_QUANTITY",
]);

export type OrderError = {
  code: OrderErrorCode | "UNKNOWN";
  message: string;
  variantId: string | null;
  /** false: no es un código nuestro (constraint, red, bug). Hay que loguearlo. */
  known: boolean;
};

export function orderError(error: DbError): OrderError {
  const { code, message, detail, known } = mapDbError(error, ORDER_ERRORS, GENERIC_ORDER_ERROR);
  const variantId = code !== "UNKNOWN" && VARIANT_DETAIL_CODES.has(code) ? detail : null;
  return { code, message, variantId, known };
}
