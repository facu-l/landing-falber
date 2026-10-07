import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "./order-transitions";

/*
 * Lecturas del admin. Reciben el cliente que devuelve requireAdmin(): corren con la
 * sesión del usuario y RLS ("admin: read orders"). Nunca service_role.
 * Sin 'use cache': el panel siempre muestra el estado actual.
 */

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Pedidos que todavía piden algo del admin: se muestran todos, sin tope. */
export const ACTIVE_STATUSES: OrderStatus[] = ["pending", "confirmed", "paid", "preparing", "ready_for_pickup", "shipped"];
/** Historial: entregados y cancelados. */
export const CLOSED_STATUSES: OrderStatus[] = ["completed", "cancelled"];
/** Tope del historial (los activos no tienen tope: uno viejo sin despachar no puede desaparecer). */
export const CLOSED_ORDERS_LIMIT = 100;

const LIST_SELECT =
  "id, order_number, customer_name, status, payment_method, delivery_method, subtotal, shipping_cost, total, created_at";

// Un solo literal (sin concatenar): supabase-js infiere el tipo de la fila desde el texto del select.
const DETAIL_SELECT = `id, order_number, customer_name, customer_email, status, payment_method, delivery_method,
  shipping_cost, delivery_address, delivery_city, delivery_postal_code, delivery_reference, order_note, subtotal,
  total, created_at, customers ( whatsapp ), order_items ( id, product_name, variant_label, unit_price, quantity )`;

/**
 * Todos los activos y los últimos cerrados, en dos consultas (las dos usan el índice
 * orders_status_created_at_idx). closedTruncated: el historial llegó al tope y puede
 * haber cerrados más viejos.
 */
export async function listAdminOrders(supabase: SessionClient) {
  const byDate = { ascending: false } as const;
  const [active, closed] = await Promise.all([
    supabase.from("orders").select(LIST_SELECT).in("status", ACTIVE_STATUSES).order("created_at", byDate),
    supabase
      .from("orders")
      .select(LIST_SELECT)
      .in("status", CLOSED_STATUSES)
      .order("created_at", byDate)
      .limit(CLOSED_ORDERS_LIMIT),
  ]);

  const error = active.error ?? closed.error;
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);
  const closedOrders = closed.data ?? [];
  return {
    orders: [...(active.data ?? []), ...closedOrders],
    closedTruncated: closedOrders.length === CLOSED_ORDERS_LIMIT,
  };
}

export type AdminOrderListItem = Awaited<ReturnType<typeof listAdminOrders>>["orders"][number];

/** null = no existe (o RLS no lo deja ver). Un id que no es UUID no se consulta: Postgres respondería 400. */
export async function getAdminOrder(supabase: SessionClient, id: string) {
  if (!z.uuid().safeParse(id).success) return null;

  const { data, error } = await supabase.from("orders").select(DETAIL_SELECT).eq("id", id).maybeSingle();

  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  return data;
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
