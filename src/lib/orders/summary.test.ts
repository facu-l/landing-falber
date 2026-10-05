// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseOrderSummary } from "./summary";

// Respuesta real de get_order_summary (Supabase local, pedido recién creado).
const row = {
  items: [{ quantity: 1, line_total: 27500, unit_price: 27500, product_name: "Santal 33", variant_label: "Decant 5 ml" }],
  total: 27500,
  status: "pending",
  subtotal: 27500,
  created_at: "2026-10-05T07:17:54.253922+00:00",
  order_number: "FAL-0002",
  shipping_cost: null,
  payment_method: "transfer",
  delivery_method: "pickup",
  customer_first_name: "Prueba",
};

describe("parseOrderSummary", () => {
  it("pasa la respuesta de la base a camelCase", () => {
    expect(parseOrderSummary(row)).toEqual({
      orderNumber: "FAL-0002",
      status: "pending",
      paymentMethod: "transfer",
      deliveryMethod: "pickup",
      subtotal: 27500,
      shippingCost: null,
      total: 27500,
      createdAt: "2026-10-05T07:17:54.253922+00:00",
      customerFirstName: "Prueba",
      items: [{ productName: "Santal 33", variantLabel: "Decant 5 ml", unitPrice: 27500, quantity: 1, lineTotal: 27500 }],
    });
  });

  it("acepta el costo de envío cuando el admin lo carga", () => {
    expect(parseOrderSummary({ ...row, shipping_cost: 3000, total: 30500 })).toMatchObject({ shippingCost: 3000 });
  });

  it("sin pedido devuelve null", () => {
    expect(parseOrderSummary(null)).toBeNull();
  });

  it("con una forma inesperada falla (es un bug, no un pedido inexistente)", () => {
    expect(() => parseOrderSummary({ ...row, status: "lost" })).toThrow();
    expect(() => parseOrderSummary({ order_number: "FAL-0002" })).toThrow();
  });
});
