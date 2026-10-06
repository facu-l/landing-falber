"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import type { OrderActionState } from "@/lib/admin/order-action-state";
import { adminOrderError } from "@/lib/admin/order-errors";
import { formValues } from "@/lib/forms/form-data";
import { ORDER_STATUS_LABELS } from "@/lib/orders/summary";
import { Constants } from "@/types/database";

const NOT_FOUND = "No encontramos el pedido. Volvé a la lista de pedidos.";

const statusChange = z.object({
  orderId: z.uuid(),
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
  const { orderId, status } = parsed.data;

  // select: sin él, un pedido que RLS no deja ver "se actualiza" sin error y sin filas.
  const { data, error } = await supabase.from("orders").update({ status }).eq("id", orderId).select("id");

  if (error) {
    const mapped = adminOrderError(error);
    if (!mapped.known) console.error("[admin] cambiar el estado del pedido falló", error);
    return { status: "error", message: mapped.message };
  }
  if (!data?.length) return { status: "error", message: NOT_FOUND };

  // Cancelar devolvió stock: el catálogo cacheado tiene que verlo ya (decisión 34).
  if (status === "cancelled") updateTag("catalog");
  refresh();

  return { status: "success", message: `Estado actualizado: ${ORDER_STATUS_LABELS[status]}.` };
}
