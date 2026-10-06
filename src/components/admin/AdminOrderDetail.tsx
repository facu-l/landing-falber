import type { ReactNode } from "react";
import type { AdminOrder } from "@/lib/admin/orders";
import { formatARS, formatDateTime } from "@/lib/format";
import { DELIVERY_LABELS, PAYMENT_LABELS } from "@/lib/orders/summary";

/** Datos del pedido para el admin (solo lectura). Los formularios van aparte. */
export function AdminOrderDetail({ order }: { order: AdminOrder }) {
  const whatsapp = order.customers?.whatsapp;
  const isDelivery = order.delivery_method === "delivery";
  const address = [order.delivery_address, order.delivery_city].filter(Boolean).join(", ");

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <dl className="flex flex-col gap-4">
        <Field label="Fecha">{formatDateTime(order.created_at)}</Field>
        <Field label="Cliente">{order.customer_name}</Field>
        {whatsapp && (
          <Field label="WhatsApp">
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-4 hover:text-accent-strong"
            >
              {whatsapp}
            </a>
          </Field>
        )}
        {order.customer_email && <Field label="Email">{order.customer_email}</Field>}
        <Field label="Pago">{PAYMENT_LABELS[order.payment_method]}</Field>
        <Field label="Entrega">{DELIVERY_LABELS[order.delivery_method]}</Field>
        {isDelivery && (
          <Field label="Dirección">
            {order.delivery_postal_code ? `${address} (${order.delivery_postal_code})` : address}
          </Field>
        )}
        {order.delivery_reference && <Field label="Referencia">{order.delivery_reference}</Field>}
        {order.order_note && <Field label="Aclaración">{order.order_note}</Field>}
      </dl>

      <div className="flex flex-col gap-4">
        <ul className="flex flex-col border-t border-border">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 border-b border-border py-3">
              <div className="flex flex-col">
                <span className="text-body text-text">{item.product_name}</span>
                <span className="text-body-sm text-text-muted">{item.variant_label}</span>
              </div>
              <span className="text-body-sm text-text-secondary">
                {item.quantity} x {formatARS(item.unit_price)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2">
          <Row label="Subtotal">{formatARS(order.subtotal)}</Row>
          {isDelivery && (
            <Row label="Envío">{order.shipping_cost === null ? "A coordinar" : formatARS(order.shipping_cost)}</Row>
          )}
          <Row label="Total" strong>
            {formatARS(order.total ?? order.subtotal)}
          </Row>
        </dl>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label text-text-muted uppercase">{label}</dt>
      <dd className="text-body text-text">{children}</dd>
    </div>
  );
}

function Row({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "text-label text-text uppercase" : "text-body-sm text-text-secondary"}>{label}</dt>
      <dd className={strong ? "text-h3 text-text" : "text-body-sm text-text"}>{children}</dd>
    </div>
  );
}
