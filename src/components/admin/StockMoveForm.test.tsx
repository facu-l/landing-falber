import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STOCK_MOVE_ERRORS, STOCK_MOVED, type StockMoveState } from "@/lib/admin/stock-movements";

const mocks = vi.hoisted(() => ({ moveStock: vi.fn() }));
vi.mock("@/app/admin/(panel)/productos/[id]/variant-actions", () => ({ moveStock: mocks.moveStock }));

const { StockMoveForm } = await import("./StockMoveForm");

const VARIANT = { id: "v1", stock: 8 };

const field = <T extends HTMLElement = HTMLInputElement>(label: string) => screen.getByLabelText(label) as T;
const choose = (value: string) => fireEvent.change(field<HTMLSelectElement>("Qué pasó"), { target: { value } });
const amount = (value: string) => fireEvent.change(field("Cantidad"), { target: { value } });

afterEach(() => vi.clearAllMocks());

describe("StockMoveForm", () => {
  it("ofrece solo los movimientos manuales, sin uno elegido de entrada", () => {
    render(<StockMoveForm variant={VARIANT} onClose={() => {}} />);
    const options = Array.from(field<HTMLSelectElement>("Qué pasó").options).map((o) => o.textContent);
    expect(options).toEqual(["Elegí una opción", "Reposición", "Ajuste: sumar", "Ajuste: restar", "Dañado o derramado"]);
    expect(field<HTMLSelectElement>("Qué pasó").value).toBe("");
  });

  it('muestra "Queda en N u." en vivo según la opción y la cantidad', () => {
    render(<StockMoveForm variant={VARIANT} onClose={() => {}} />);
    expect(screen.queryByText(/Queda en/)).toBeNull();

    choose("restock");
    amount("3");
    expect(screen.getByText("Queda en 11 u.")).toBeTruthy();

    choose("damaged");
    expect(screen.getByText("Queda en 5 u.")).toBeTruthy();

    amount("x");
    expect(screen.queryByText(/Queda en/)).toBeNull();
  });

  it("avisa antes de enviar si no hay tanto stock para descontar", () => {
    render(<StockMoveForm variant={VARIANT} onClose={() => {}} />);
    choose("adjustment_subtract");
    amount("9");
    expect(screen.getByText(STOCK_MOVE_ERRORS.notEnoughStock)).toBeTruthy();
    expect(screen.queryByText(/Queda en/)).toBeNull();
  });

  it("después de un error marca el campo y conserva lo elegido y lo escrito", async () => {
    mocks.moveStock.mockResolvedValue({
      status: "error",
      fieldErrors: { quantity: STOCK_MOVE_ERRORS.notEnoughStock },
      values: { choice: "damaged", quantity: "2", note: "Se cayó" },
    } satisfies StockMoveState);
    render(<StockMoveForm variant={VARIANT} onClose={() => {}} />);
    choose("damaged");
    amount("2");
    fireEvent.change(field("Nota"), { target: { value: "Se cayó" } });
    fireEvent.click(screen.getByRole("button", { name: "Mover stock" }));

    // El error del servidor (una venta lo dejó corto entre medio) va debajo de Cantidad.
    await screen.findByText(STOCK_MOVE_ERRORS.notEnoughStock);
    expect(field("Cantidad").getAttribute("aria-invalid")).toBe("true");
    expect(field<HTMLSelectElement>("Qué pasó").value).toBe("damaged");
    expect(field("Cantidad").value).toBe("2");
    expect(field("Nota").value).toBe("Se cayó");
  });

  it("al mover avisa, vacía el formulario y Cancelar pasa a Cerrar", async () => {
    mocks.moveStock.mockResolvedValue({ status: "success", message: STOCK_MOVED } satisfies StockMoveState);
    render(<StockMoveForm variant={VARIANT} onClose={() => {}} />);
    choose("restock");
    amount("3");
    fireEvent.click(screen.getByRole("button", { name: "Mover stock" }));

    expect((await screen.findByRole("status")).textContent).toBe(STOCK_MOVED);
    expect(field<HTMLSelectElement>("Qué pasó").value).toBe("");
    expect(field("Cantidad").value).toBe("");
    expect(screen.queryByText(/Queda en/)).toBeNull();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
  });
});
