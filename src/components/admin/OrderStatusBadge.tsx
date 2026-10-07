import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/admin/order-transitions";
import { ORDER_STATUS_LABELS } from "@/lib/orders/summary";

/*
 * Estado del pedido. Los tonos varían en luminosidad, no solo en color (DESIGN.md →
 * Accesibilidad): pendiente = relleno oscuro (pide acción), en curso = borde, cerrado = apagado.
 */
const TONES: Record<OrderStatus, "action" | "active" | "closed"> = {
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
  const tone = TONES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-1 text-caption uppercase",
        tone === "action" && "border-accent bg-accent text-on-accent",
        tone === "active" && "border-border-strong text-text",
        tone === "closed" && "border-border text-text-muted",
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
