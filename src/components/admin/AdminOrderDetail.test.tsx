import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminOrder } from "@/lib/admin/orders";
import { AdminOrderDetail } from "./AdminOrderDetail";

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "f060303b-8447-45e5-ab0c-c59cd1705419",
    order_number: "FAL-0007",
    customer_name: "Carla Gómez",
    customer_email: "carla@example.com",
    status: "confirmed",
    payment_method: "transfer",
    delivery_method: "delivery",
    shipping_cost: null,
    delivery_address: "Calle 7 1234",
    delivery_city: "La Plata",
    delivery_postal_code: "1900",
    delivery_reference: "Timbre B",
    order_note: "Para regalo",
    subtotal: 40500,
    total: 40500,
    created_at: "2026-10-06T18:00:00Z",
    customers: { whatsapp: "+5492215551234" },
    order_items: [
      { id: "i1", product_name: "Sauvage EDT", variant_label: "Decant 5 ml", unit_price: 14500, quantity: 1, line_total: 14500 },
      { id: "i2", product_name: "Sauvage EDT", variant_label: "Decant 10 ml", unit_price: 26000, quantity: 1, line_total: 26000 },
    ],
    ...overrides,
  };
}

describe("AdminOrderDetail", () => {
  it("muestra el cliente con un link a su WhatsApp", () => {
    render(<AdminOrderDetail order={order()} />);
    screen.getByText("Carla Gómez");
    const link = screen.getByRole("link", { name: "+5492215551234" });
    expect(link.getAttribute("href")).toBe("https://wa.me/5492215551234");
  });

  it("muestra la dirección completa de un envío y la aclaración", () => {
    render(<AdminOrderDetail order={order()} />);
    screen.getByText("Calle 7 1234, La Plata (1900)");
    screen.getByText("Timbre B");
    screen.getByText("Para regalo");
  });

  it("lista los ítems y los totales; un envío sin costo dice 'A coordinar'", () => {
    render(<AdminOrderDetail order={order()} />);
    screen.getByText("Decant 10 ml");
    expect(screen.getAllByText("Sauvage EDT")).toHaveLength(2);
    screen.getByText("A coordinar");
  });

  it("un retiro no muestra dirección ni costo de envío", () => {
    render(
      <AdminOrderDetail
        order={order({ delivery_method: "pickup", delivery_address: null, delivery_city: null, delivery_postal_code: null, delivery_reference: null })}
      />,
    );
    screen.getByText("Retiro en La Plata");
    expect(screen.queryByText("A coordinar")).toBeNull();
  });
});
