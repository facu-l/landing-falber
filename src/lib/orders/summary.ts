import { z } from "zod";
import { Constants } from "@/types/database";

/*
 * Resumen público de un pedido: lo que devuelve get_order_summary (jsonb, snake_case)
 * pasado a camelCase. Sin datos sensibles: solo el nombre de pila del cliente.
 */

const itemRow = z
  .object({
    product_name: z.string(),
    variant_label: z.string(),
    unit_price: z.number(),
    quantity: z.int(),
    line_total: z.number(),
  })
  .transform((i) => ({
    productName: i.product_name,
    variantLabel: i.variant_label,
    unitPrice: i.unit_price,
    quantity: i.quantity,
    lineTotal: i.line_total,
  }));

const summaryRow = z
  .object({
    order_number: z.string(),
    status: z.enum(Constants.public.Enums.order_status),
    payment_method: z.enum(Constants.public.Enums.payment_method),
    delivery_method: z.enum(Constants.public.Enums.delivery_method),
    subtotal: z.number(),
    // null hasta que el admin carga el costo de envío.
    shipping_cost: z.number().nullable(),
    total: z.number(),
    created_at: z.string(),
    customer_first_name: z.string(),
    items: z.array(itemRow),
  })
  .transform((o) => ({
    orderNumber: o.order_number,
    status: o.status,
    paymentMethod: o.payment_method,
    deliveryMethod: o.delivery_method,
    subtotal: o.subtotal,
    shippingCost: o.shipping_cost,
    total: o.total,
    createdAt: o.created_at,
    customerFirstName: o.customer_first_name,
    items: o.items,
  }));

export type OrderSummary = z.output<typeof summaryRow>;
export type OrderSummaryItem = OrderSummary["items"][number];

/**
 * null = el pedido no existe. Una forma inesperada lanza: es un bug (la función de
 * la base cambió), y tiene que verse en error.tsx, no como un pedido inexistente.
 */
export function parseOrderSummary(data: unknown): OrderSummary | null {
  if (data === null) return null;
  return summaryRow.parse(data);
}

export const ORDER_STATUS_LABELS: Record<OrderSummary["status"], string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  paid: "Pagado",
  preparing: "En preparación",
  ready_for_pickup: "Listo para retirar",
  shipped: "Enviado",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const DELIVERY_LABELS: Record<OrderSummary["deliveryMethod"], string> = {
  pickup: "Retiro en La Plata",
  delivery: "Envío a domicilio",
};

export const PAYMENT_LABELS: Record<OrderSummary["paymentMethod"], string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
};
