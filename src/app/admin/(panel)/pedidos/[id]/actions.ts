"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import type { OrderActionState } from "@/lib/admin/order-action-state";
import { adminOrderError } from "@/lib/admin/order-errors";
import { parseShippingCost } from "@/lib/admin/shipping";
import { formatARS } from "@/lib/format";
import { formValues } from "@/lib/forms/form-data";
import { ORDER_STATUS_LABELS } from "@/lib/orders/summary";
import { Constants, type Database } from "@/types/database";

/*
 * Acciones del detalle de un pedido. Cada una empieza con requireAdmin() y escribe con
 * el cliente de la sesión (RLS + permisos de columna: solo status y shipping_cost).
 * Las reglas las valida la base; acá solo se traducen sus errores.
 */

const NOT_FOUND = "No encontramos el pedido. Volvé a la lista de pedidos.";

type SessionClient = Awaited<ReturnType<typeof requireAdmin>>["supabase"];
type OrderUpdate = Pick<Database["public"]["Tables"]["orders"]["Update"], "status" | "shipping_cost">;

const orderId = z.uuid();

const statusChange = z.object({
  orderId,
  status: z.enum(Constants.public.Enums.order_status),
});

/**
 * Cambia el estado de un pedido. La base valida la transición (is_valid_order_transition)
 * y al cancelar devuelve el stock (trigger handle_order_status_change).
 */
export async function updateOrderStatus(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const { supabase } = await requireAdmin();

  const parsed = statusChange.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", message: "Elegí un estado de la lista." };
  const { status } = parsed.data;

  const failure = await updateOrder(supabase, parsed.data.orderId, { status }, "cambiar el estado del pedido");
  if (failure) return { status: "error", message: failure };

  // Cancelar devolvió stock: el catálogo cacheado tiene que verlo ya (decisión 34).
  if (status === "cancelled") updateTag("catalog");
  refresh();

  return { status: "success", message: `Estado actualizado: ${ORDER_STATUS_LABELS[status]}.` };
}

/**
 * Carga el costo de envío (vacío = a coordinar). La base lo rechaza en retiros y en
 * pedidos enviados o cerrados (guard_shipping_cost). No cambia stock: sin updateTag.
 */
export async function setShippingCost(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const { supabase } = await requireAdmin();

  const values = formValues(formData);
  const kept = { shippingCost: values.shippingCost ?? "" };

  const id = orderId.safeParse(values.orderId);
  if (!id.success) return { status: "error", message: NOT_FOUND, values: kept };
  const cost = parseShippingCost(kept.shippingCost);
  if (!cost.success) return { status: "error", message: cost.error, values: kept };

  const failure = await updateOrder(supabase, id.data, { shipping_cost: cost.value }, "cargar el costo de envío");
  if (failure) return { status: "error", message: failure, values: kept };

  refresh();
  return {
    status: "success",
    message:
      cost.value === null
        ? "Costo de envío borrado: queda a coordinar."
        : `Costo de envío guardado: ${formatARS(cost.value)}.`,
  };
}

/** Escribe en el pedido. Devuelve el mensaje de error para el admin, o null si salió bien. */
async function updateOrder(supabase: SessionClient, id: string, change: OrderUpdate, what: string) {
  // select: sin él, un pedido que RLS no deja ver "se actualiza" sin error y sin filas.
  const { data, error } = await supabase.from("orders").update(change).eq("id", id).select("id");

  if (error) {
    const mapped = adminOrderError(error);
    if (!mapped.known) console.error(`[admin] ${what} falló`, error);
    return mapped.message;
  }
  return data?.length ? null : NOT_FOUND;
}
