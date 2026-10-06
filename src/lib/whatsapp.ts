import { formatARS } from "./format";
import { DELIVERY_LABELS, type OrderSummary, PAYMENT_LABELS } from "./orders/summary";

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

/** wa.me exige el número solo con dígitos: 549 + área + número, sin "+", 0 ni 15. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
