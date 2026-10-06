import { buttonClasses } from "@/components/ui/Button";
import { formatARS } from "@/lib/format";
import { DELIVERY_LABELS, ORDER_STATUS_LABELS, type OrderSummary, PAYMENT_LABELS } from "@/lib/orders/summary";

/**
 * "Detalle de tu compra" (sección 6 del documento maestro). Recibe el pedido y el
 * link de WhatsApp ya armados: sin datos ni red, se testea solo.
 */
export function OrderDetails({ order, whatsAppUrl }: { order: OrderSummary; whatsAppUrl: string }) {
  const cancelled = order.status === "cancelled";

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-h1 text-text uppercase">Detalle de tu compra</h1>
          <p className="text-label text-text-secondary uppercase tabular-nums">{order.orderNumber}</p>
        </div>
        <p className="text-body text-text-secondary">
          Estado del pedido: <span className="text-text">{ORDER_STATUS_LABELS[order.status]}</span>
        </p>
      </header>

      <section aria-label="Productos" className="flex flex-col gap-4">
        <ul className="flex flex-col border-t border-border">
          {order.items.map((item) => (
            <li
              key={`${item.productName}-${item.variantLabel}`}
              className="flex items-baseline justify-between gap-4 border-b border-border py-4"
            >
              <span className="text-body text-text">
                {item.quantity} × {item.productName} — {item.variantLabel}
              </span>
              <span className="text-body text-text tabular-nums">{formatARS(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-2">
          {order.shippingCost !== null && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm text-text-secondary">Envío</dt>
              <dd className="text-body-sm text-text tabular-nums">{formatARS(order.shippingCost)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-label text-text-secondary uppercase">Total estimado</dt>
            <dd data-testid="order-total" className="text-h2 text-text tabular-nums">
              {formatARS(order.total)}
            </dd>
          </div>
        </dl>
        {order.shippingCost === null && (
          <p className="text-caption text-text-muted">El envío, si corresponde, se coordina por WhatsApp.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-4 border-y border-border py-6">
        <div className="flex flex-col gap-1">
          <dt className="text-label text-text-muted uppercase">Entrega</dt>
          <dd className="text-body text-text">{DELIVERY_LABELS[order.deliveryMethod]}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-label text-text-muted uppercase">Pago</dt>
          <dd className="text-body text-text">{PAYMENT_LABELS[order.paymentMethod]}</dd>
        </div>
      </dl>

      {cancelled ? (
        <p className="text-body text-text-secondary">
          Este pedido fue cancelado. Si querés comprar de nuevo, armá un carrito nuevo.
        </p>
      ) : (
        <div className="flex flex-col items-start gap-4">
          <p className="text-body text-text-secondary">
            Gracias, {order.customerFirstName}. Para confirmar tu pedido, escribinos por WhatsApp: el mensaje
            ya va armado con el detalle.
          </p>
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("primary", "w-full md:w-auto")}
          >
            Completar pedido en WhatsApp
          </a>
        </div>
      )}
    </article>
  );
}
