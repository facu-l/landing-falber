import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

/** Resumen público de un pedido (lo que devuelve get_order_summary, en camelCase). */
export type OrderSummary = {
  orderNumber: string;
  status: Enums["order_status"];
  paymentMethod: Enums["payment_method"];
  deliveryMethod: Enums["delivery_method"];
  subtotal: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  customerFirstName: string;
  items: OrderSummaryItem[];
};

export type OrderSummaryItem = {
  productName: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export const DELIVERY_LABELS: Record<OrderSummary["deliveryMethod"], string> = {
  pickup: "Retiro en La Plata",
  delivery: "Envío a domicilio",
};

export const PAYMENT_LABELS: Record<OrderSummary["paymentMethod"], string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
};
