import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/(panel)/productos/[id]/actions", () => ({ updateProductData: vi.fn() }));

const { ProductDataForm } = await import("./ProductDataForm");

const product = {
  id: "p1",
  slug: "dior-sauvage-edt",
  brand: "Dior",
  name: "Sauvage EDT",
  gender: null,
  description: null,
  is_featured: true,
};

describe("ProductDataForm", () => {
  it("muestra lo guardado, con Sin género y destacado tildado", () => {
    render(<ProductDataForm product={product} />);
    expect((screen.getByLabelText("Marca") as HTMLInputElement).value).toBe("Dior");
    expect((screen.getByLabelText("Género") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("option", { name: "Sin género" })).toBeTruthy();
    expect((screen.getByLabelText("Destacado") as HTMLInputElement).checked).toBe(true);
  });

  it("avisa que el link no cambia aunque se corrija el nombre", () => {
    render(<ProductDataForm product={product} />);
    expect(screen.getByText("El link no cambia: /producto/dior-sauvage-edt")).toBeTruthy();
    expect(screen.getByText("La home muestra hasta 3 destacados con stock.")).toBeTruthy();
  });

  it("no tiene campo de slug: el servidor no lo lee", () => {
    const { container } = render(<ProductDataForm product={product} />);
    expect(container.querySelector('[name="slug"]')).toBeNull();
  });
});
