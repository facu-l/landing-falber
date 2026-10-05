import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderSummary } from "@/lib/orders/summary";
import { OrderDetails } from "./OrderDetails";

const order: OrderSummary = {
  orderNumber: "FAL-0042",
  status: "pending",
  paymentMethod: "transfer",
  deliveryMethod: "pickup",
  subtotal: 38500,
  shippingCost: null,
  total: 38500,
  createdAt: "2026-10-05T12:00:00Z",
  customerFirstName: "Ana",
  items: [
    { productName: "Sauvage EDT", variantLabel: "Decant 5 ml", unitPrice: 10000, quantity: 1, lineTotal: 10000 },
    { productName: "Santal 33", variantLabel: "Decant 10 ml", unitPrice: 14250, quantity: 2, lineTotal: 28500 },
  ],
};
const whatsAppUrl = "https://wa.me/5492355481449?text=Hola";

describe("OrderDetails", () => {
  it("muestra el número, el estado y cada producto", () => {
    render(<OrderDetails order={order} whatsAppUrl={whatsAppUrl} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch("Detalle de tu compra");
    expect(screen.getByText("FAL-0042")).toBeTruthy();
    expect(screen.getByText(/Estado del pedido/).textContent).toMatch("Pendiente");
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/1 × Sauvage EDT — Decant 5 ml.*\$\s?10\.000/);
    expect(items[1]).toMatch(/2 × Santal 33 — Decant 10 ml.*\$\s?28\.500/);
  });

  it("muestra el total estimado y aclara que el envío se coordina", () => {
    render(<OrderDetails order={order} whatsAppUrl={whatsAppUrl} />);
    expect(screen.getByTestId("order-total").textContent).toMatch(/\$\s?38\.500/);
    expect(screen.getByText(/el envío, si corresponde, se coordina por WhatsApp/i)).toBeTruthy();
  });

  it("con el envío ya cargado lo muestra como una línea más", () => {
    render(<OrderDetails order={{ ...order, shippingCost: 3000, total: 41500 }} whatsAppUrl={whatsAppUrl} />);
    expect(screen.getByText("Envío").parentElement?.textContent).toMatch(/\$\s?3\.000/);
    expect(screen.getByTestId("order-total").textContent).toMatch(/\$\s?41\.500/);
  });

  it("el botón abre WhatsApp con el mensaje armado, en otra pestaña", () => {
    render(<OrderDetails order={order} whatsAppUrl={whatsAppUrl} />);
    const link = screen.getByRole("link", { name: "Completar pedido en WhatsApp" });
    expect(link.getAttribute("href")).toBe(whatsAppUrl);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("un pedido cancelado no ofrece completar por WhatsApp", () => {
    render(<OrderDetails order={{ ...order, status: "cancelled" }} whatsAppUrl={whatsAppUrl} />);
    expect(screen.getByText(/Estado del pedido/).textContent).toMatch("Cancelado");
    expect(screen.queryByRole("link", { name: "Completar pedido en WhatsApp" })).toBeNull();
  });
});
