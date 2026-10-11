import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(panel)/productos/actions", () => ({ createProduct: vi.fn() }));

const { NewProductForm } = await import("./NewProductForm");

const details = () => screen.getByText("Nuevo producto").closest("details")!;

describe("NewProductForm", () => {
  it("cerrado de entrada; abierto si se pide (lista vacía)", () => {
    const { unmount } = render(<NewProductForm />);
    expect(details().open).toBe(false);
    unmount();

    render(<NewProductForm defaultOpen />);
    expect(details().open).toBe(true);
  });

  it("arma el link mientras se escribe, igual que el servidor", () => {
    render(<NewProductForm defaultOpen />);
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Dior" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Sauvage EDT" } });

    expect((screen.getByLabelText("Link") as HTMLInputElement).value).toBe("/producto/dior-sauvage-edt");
  });

  it("el link es de solo lectura y no se envía (lo arma el servidor)", () => {
    render(<NewProductForm defaultOpen />);
    const link = screen.getByLabelText("Link") as HTMLInputElement;
    expect(link.readOnly).toBe(true);
    expect(link.name).toBe("");
  });
});
