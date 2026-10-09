"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { type CheckoutData, parseCheckout } from "@/lib/checkout/schema";
import type { CheckoutState } from "@/lib/checkout/state";
import { formValues, TURNSTILE_FIELD } from "@/lib/forms/form-data";
import { loggableDbError } from "@/lib/db-errors";
import { GENERIC_ORDER_ERROR, orderError } from "@/lib/order-errors";
import { verifyHumanRequest } from "@/lib/security/verify-request";
import { createServiceClient } from "@/lib/supabase/service";

const TURNSTILE_FAILED =
  "No pudimos verificar tu navegador. Esperá unos segundos y volvé a tocar Realizar compra.";

// Lo que devuelve create_order (también en un reintento con el mismo request_id).
const createdOrder = z.object({ order_id: z.uuid() });

/**
 * Crea el pedido. Orden:
 * 1. zod: valida y normaliza (sin red; no gasta el token de Turnstile en un error de tipeo)
 * 2. Turnstile, con la IP real
 * 3. create_order con service_role y la IP hasheada
 * 4. updateTag('catalog'): el stock cambió (decisión 34)
 *
 * Devuelve el id y el cliente navega a /pedido/[id] después de vaciar el carrito:
 * con redirect() el navegador no sabría que la compra salió bien.
 */
export async function createOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values = formValues(formData, [TURNSTILE_FIELD]);

  const parsed = parseCheckout(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const human = await verifyHumanRequest(formData, "checkout");
  if (!human.ok) return { status: "error", message: TURNSTILE_FAILED, values };

  try {
    const { data, error } = await createServiceClient().rpc(
      "create_order",
      toCreateOrderArgs(parsed.data, human.clientKey),
    );

    if (error) {
      const mapped = orderError(error);
      if (!mapped.known) console.error("[checkout] create_order falló", loggableDbError(error));
      return { status: "error", message: mapped.message, variantId: mapped.variantId, values };
    }

    const order = createdOrder.safeParse(data);
    if (!order.success) {
      console.error("[checkout] create_order devolvió algo inesperado", data);
      return { status: "error", message: GENERIC_ORDER_ERROR, values };
    }

    updateTag(CATALOG_TAG);
    return { status: "success", orderId: order.data.order_id };
  } catch (error) {
    console.error("[checkout] no se pudo llamar a create_order", error);
    return { status: "error", message: GENERIC_ORDER_ERROR, values };
  }
}

/*
 * Los tipos generados declaran los argumentos de texto como string (no null).
 * Se manda "" para lo vacío: create_order lo convierte en null con nullif(trim(...)).
 */
function toCreateOrderArgs(order: CheckoutData, clientKey: string) {
  return {
    p_request_id: order.requestId,
    p_client_key: clientKey,
    p_full_name: order.fullName,
    p_whatsapp: order.whatsapp,
    p_email: order.email ?? "",
    p_payment_method: order.paymentMethod,
    p_delivery_method: order.deliveryMethod,
    p_delivery_address: order.address ?? "",
    p_delivery_city: order.city ?? "",
    p_delivery_postal_code: order.postalCode ?? "",
    p_delivery_reference: order.reference ?? "",
    p_order_note: order.note ?? "",
    p_items: order.items.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
  };
}
