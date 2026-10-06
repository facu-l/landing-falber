import { Constants, type Database } from "@/types/database";

type Enums = Database["public"]["Enums"];
export type OrderStatus = Enums["order_status"];

export type OrderForTransition = {
  status: OrderStatus;
  payment_method: Enums["payment_method"];
  delivery_method: Enums["delivery_method"];
};

/*
 * Copia de public.is_valid_order_transition (supabase/migrations/0001_initial_schema.sql),
 * solo para mostrar en el admin los estados posibles. La base sigue decidiendo: si esta
 * copia se desfasa, el trigger rechaza con INVALID_STATUS_TRANSITION. Las dos se prueban
 * contra supabase/tests/order-transitions.json.
 */
function isValidTransition(from: OrderStatus, to: OrderStatus, order: OrderForTransition): boolean {
  if (from === "cancelled") return false;
  if (to === "cancelled") return from !== "shipped" && from !== "completed";

  switch (from) {
    case "pending":
      return to === "confirmed";
    case "confirmed":
      return to === "paid" || (to === "preparing" && order.payment_method === "cash");
    case "paid":
      return to === "preparing";
    case "preparing":
      return (
        (to === "ready_for_pickup" && order.delivery_method === "pickup") ||
        (to === "shipped" && order.delivery_method === "delivery")
      );
    case "ready_for_pickup":
    case "shipped":
      return to === "completed";
    default:
      return false;
  }
}

/** Estados a los que puede pasar el pedido, en el orden del flujo (cancelar al final). */
export function nextOrderStatuses(order: OrderForTransition): OrderStatus[] {
  return Constants.public.Enums.order_status.filter(
    (to) => to !== order.status && isValidTransition(order.status, to, order),
  );
}
