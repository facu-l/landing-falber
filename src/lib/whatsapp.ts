import { formatARS } from "./format";
import { DELIVERY_LABELS, type OrderSummary, PAYMENT_LABELS } from "./orders/summary";
import type { RequestData } from "./requests/schema";

/*
 * Mensaje y link del botón "Completar pedido en WhatsApp" (sección 6 del documento maestro).
 * Voz de la marca: sin emojis ni signos de exclamación.
 */

// En el chat va "$10.000", sin el espacio duro de Intl: así no se corta en dos líneas.
function price(amount: number): string {
  return formatARS(amount).replace(/\s/g, "");
}

export function buildWhatsAppMessage(order: OrderSummary): string {
  const items = order.items.map(
    (i) => `• ${i.quantity}x ${i.productName} — ${i.variantLabel} (${price(i.lineTotal)})`,
  );
  // El costo de envío lo carga el admin después; si ya está, el total lo incluye.
  const shipping = order.shippingCost ? [`Envío: ${price(order.shippingCost)}`] : [];

  return [
    `Hola FALBER. Quiero confirmar mi pedido ${order.orderNumber}.`,
    "",
    ...items,
    "",
    ...shipping,
    `Total estimado: ${price(order.total)}`,
    `Entrega: ${DELIVERY_LABELS[order.deliveryMethod]}`,
    `Pago: ${PAYMENT_LABELS[order.paymentMethod]}`,
  ].join("\n");
}

/**
 * Mensaje del botón "Enviar por WhatsApp" de la confirmación de /encargos. El encargo
 * ya quedó guardado; el mensaje es el aviso, porque la base no notifica a nadie.
 * Sin el WhatsApp del cliente: al escribir, el número ya llega con el chat.
 */
export function buildRequestWhatsAppMessage(
  request: Pick<RequestData, "fullName" | "perfumeName" | "brand" | "presentation" | "note">,
): string {
  const optional = [
    request.brand && `Marca: ${request.brand}`,
    request.presentation && `Presentación: ${request.presentation}`,
    request.note && `Nota: ${request.note}`,
  ].filter((line) => typeof line === "string");

  return [
    `Hola FALBER. Soy ${request.fullName} y hice un encargo en la web.`,
    "",
    `Perfume: ${request.perfumeName}`,
    ...optional,
  ].join("\n");
}

/** wa.me exige el número solo con dígitos: 549 + área + número, sin "+", 0 ni 15. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
