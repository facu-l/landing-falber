import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminOrderListItem } from "@/lib/admin/orders";
import { AdminOrderList } from "./AdminOrderList";

const NOW = new Date("2026-10-06T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function order(overrides: Partial<AdminOrderListItem>): AdminOrderListItem {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    order_number: "FAL-0001",
    customer_name: "Ana Pérez",
    status: "pending",
    payment_method: "transfer",
    delivery_method: "pickup",
    shipping_cost: null,
    total: 14500,
    created_at: hoursAgo(1),
    ...overrides,
  };
}

const rows = () => screen.getAllByRole("listitem");

describe("AdminOrderList", () => {
  it("muestra los pendientes primero y cada pedido lleva a su detalle", () => {
    render(
      <AdminOrderList
        now={NOW}
        orders={[
          order({ id: "a", order_number: "FAL-0002", status: "confirmed", created_at: hoursAgo(1) }),
          order({ id: "b", order_number: "FAL-0001", status: "pending", created_at: hoursAgo(3) }),
        ]}
      />,
    );

    expect(rows().map((row) => within(row).getByRole("link").textContent)).toEqual(["FAL-0001", "FAL-0002"]);
    expect(within(rows()[0]).getByRole("link").getAttribute("href")).toBe("/admin/pedidos/b");
    within(rows()[0]).getByText("Pendiente");
    within(rows()[1]).getByText("Confirmado");
  });

  it("avisa cuánto falta para la cancelación automática de un pendiente viejo", () => {
    render(<AdminOrderList now={NOW} orders={[order({ created_at: hoursAgo(40.5) })]} />);
    screen.getByText("Se cancela sola en 7 h");
  });

  it("con menos de una hora lo dice así", () => {
    render(<AdminOrderList now={NOW} orders={[order({ created_at: hoursAgo(47.5) })]} />);
    screen.getByText("Se cancela sola en menos de 1 h");
  });

  it("marca los envíos activos sin costo de envío cargado", () => {
    render(
      <AdminOrderList
        now={NOW}
        orders={[
          order({ id: "a", delivery_method: "delivery", status: "confirmed" }),
          order({ id: "b", delivery_method: "delivery", status: "confirmed", shipping_cost: 3500 }),
          order({ id: "c", delivery_method: "delivery", status: "cancelled" }),
        ]}
      />,
    );
    expect(screen.getAllByText("Falta el costo de envío")).toHaveLength(1);
  });

  it("sin pedidos lo dice", () => {
    render(<AdminOrderList now={NOW} orders={[]} />);
    screen.getByText("Todavía no hay pedidos.");
  });
});
