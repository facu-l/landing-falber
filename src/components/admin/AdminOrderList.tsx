import Link from "next/link";
import { autoCancelWarning, sortOrdersForAdmin } from "@/lib/admin/order-list";
import { type AdminOrderListItem, CLOSED_ORDERS_LIMIT } from "@/lib/admin/orders";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";
import { canSetShippingCost } from "@/lib/admin/shipping";
import { formatARS, formatDateTime } from "@/lib/format";
import { DELIVERY_LABELS } from "@/lib/orders/summary";
import { OrderStatusBadge } from "./OrderStatusBadge";

type Props = { orders: AdminOrderListItem[]; now: Date; closedTruncated?: boolean };

/**
 * Lista de pedidos del admin. `now` entra como prop: la página lo toma una vez por
 * request y el componente queda puro (se prueba con una hora fija).
 * closedTruncated: el historial (entregados y cancelados) llegó al tope de la consulta.
 */
export function AdminOrderList({ orders, now, closedTruncated = false }: Props) {
  if (orders.length === 0) return <p className="text-body text-text-secondary">Todavía no hay pedidos.</p>;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col border-t border-border">
        {sortOrdersForAdmin(orders).map((order) => {
          const warning = autoCancelWarning(order, now);
          const missingShipping = order.shipping_cost === null && canSetShippingCost(order);

          return (
            <li key={order.id} className="flex flex-col gap-2 border-b border-border py-4 md:flex-row md:items-center md:gap-6">
              <div className="flex items-center gap-4 md:w-56">
                <Link
                  href={`${ADMIN_ORDERS_PATH}/${order.id}`}
                  className="text-h3 text-text underline-offset-4 hover:underline"
                >
                  {order.order_number}
                </Link>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-body text-text">{order.customer_name}</span>
                <span className="text-body-sm text-text-muted">
                  {formatDateTime(order.created_at)} · {DELIVERY_LABELS[order.delivery_method]}
                </span>
                {warning && (
                  <span className="text-body-sm text-error">
                    {warning.hoursLeft === 0
                      ? "Se cancela sola en menos de 1 h"
                      : `Se cancela sola en ${warning.hoursLeft} h`}
                  </span>
                )}
                {missingShipping && <span className="text-body-sm text-text-secondary">Falta el costo de envío</span>}
              </div>
              <span className="text-body text-text md:text-right">{formatARS(order.total ?? order.subtotal)}</span>
            </li>
          );
        })}
      </ul>
      {closedTruncated && (
        <p className="text-body-sm text-text-muted">
          Se muestran los últimos {CLOSED_ORDERS_LIMIT} pedidos entregados o cancelados.
        </p>
      )}
    </div>
  );
}
