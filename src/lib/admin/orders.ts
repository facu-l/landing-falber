import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";

/*
 * Lecturas del admin. Reciben el cliente que devuelve requireAdmin(): corren con la
 * sesión del usuario y RLS ("admin: read orders"). Nunca service_role.
 * Sin 'use cache': el panel siempre muestra el estado actual.
 */

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Tope de la lista. Los pendientes tienen como mucho 48 h (pg_cron cancela el resto),
 * así que siempre están entre los más recientes.
 */
export const ORDER_LIST_LIMIT = 100;

const LIST_SELECT =
  "id, order_number, customer_name, status, payment_method, delivery_method, subtotal, shipping_cost, total, created_at";

// Un solo literal (sin concatenar): supabase-js infiere el tipo de la fila desde el texto del select.
const DETAIL_SELECT = `id, order_number, customer_name, customer_email, status, payment_method, delivery_method,
  shipping_cost, delivery_address, delivery_city, delivery_postal_code, delivery_reference, order_note, subtotal,
  total, created_at, customers ( whatsapp ), order_items ( id, product_name, variant_label, unit_price, quantity )`;

export async function listAdminOrders(supabase: SessionClient) {
  const { data, error } = await supabase
    .from("orders")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(ORDER_LIST_LIMIT);

  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);
  return data;
}

export type AdminOrderListItem = Awaited<ReturnType<typeof listAdminOrders>>[number];

/** null = no existe (o RLS no lo deja ver). Un id que no es UUID no se consulta: Postgres respondería 400. */
export async function getAdminOrder(supabase: SessionClient, id: string) {
  if (!z.uuid().safeParse(id).success) return null;

  const { data, error } = await supabase.from("orders").select(DETAIL_SELECT).eq("id", id).maybeSingle();

  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`);
  return data;
}

export type AdminOrder = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
