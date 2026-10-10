import type { OrderStatus } from "@/lib/admin/order-transitions";
import { ORDER_STATUS_LABELS } from "@/lib/orders/summary";
import { StatusBadge, type StatusTone } from "./StatusBadge";

/* Pendiente pide acción; en curso, borde; cerrado, apagado (StatusBadge). */
const TONES: Record<OrderStatus, StatusTone> = {
  pending: "action",
  confirmed: "active",
  paid: "active",
  preparing: "active",
  ready_for_pickup: "active",
  shipped: "active",
  completed: "closed",
  cancelled: "closed",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge tone={TONES[status]}>{ORDER_STATUS_LABELS[status]}</StatusBadge>;
}
