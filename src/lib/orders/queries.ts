import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { type OrderSummary, parseOrderSummary } from "./summary";

const orderId = z.uuid();

/**
 * Resumen del pedido para /pedido/[id]. Sin caché: es de una sola persona y el
 * estado cambia cuando el admin lo confirma.
 *
 * get_order_summary es solo para service_role: el UUID (imposible de adivinar)
 * funciona como link privado, y la función no devuelve datos sensibles.
 */
export async function getOrderSummary(id: string): Promise<OrderSummary | null> {
  // Postgres responde 400 a un id que no es UUID: para el cliente es "no encontrado".
  if (!orderId.safeParse(id).success) return null;

  const { data, error } = await createServiceClient().rpc("get_order_summary", { p_order_id: id });
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  return parseOrderSummary(data);
}
