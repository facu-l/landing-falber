import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StockHistoryEntry } from "@/lib/admin/stock-movements";
import { StockHistory } from "./StockHistory";

const entry = (over: Partial<StockHistoryEntry>): StockHistoryEntry => ({
  id: "m1",
  movement_type: "restock",
  quantity: 3,
  note: null,
  created_at: "2026-10-12T18:30:00Z",
  orders: null,
  ...over,
});

describe("StockHistory", () => {
  it("sin movimientos lo dice", () => {
    render(<StockHistory entries={[]} />);
    expect(screen.getByText("Historial (últimos 5)")).toBeTruthy();
    expect(screen.getByText("Sin movimientos todavía.")).toBeTruthy();
  });

  it("cada movimiento con fecha de Argentina, tipo, signo y nota", () => {
    render(
      <StockHistory
        entries={[
          entry({ id: "m1", movement_type: "damaged", quantity: -1, note: "Se cayó" }),
          entry({ id: "m2", movement_type: "initial_stock", quantity: 4 }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("12/10 15:30")).toBeTruthy();
    expect(within(rows[0]).getByText("Dañado o derramado")).toBeTruthy();
    expect(within(rows[0]).getByText("−1")).toBeTruthy();
    expect(within(rows[0]).getByText("Se cayó")).toBeTruthy();
    expect(within(rows[1]).getByText("Stock inicial")).toBeTruthy();
    expect(within(rows[1]).getByText("+4")).toBeTruthy();
  });

  it("una venta lleva al pedido y no repite el número como nota", () => {
    render(
      <StockHistory
        entries={[entry({ movement_type: "sale", quantity: -2, note: "FAL-0042", orders: { id: "o1", order_number: "FAL-0042" } })]}
      />,
    );
    const link = screen.getByRole("link", { name: "Pedido FAL-0042" });
    expect(link.getAttribute("href")).toBe("/admin/pedidos/o1");
    expect(screen.getAllByText(/FAL-0042/)).toHaveLength(1);
  });
});
