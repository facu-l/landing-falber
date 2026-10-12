import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminProductRow } from "@/lib/admin/product-list";

// productImageSrc lee la URL de Supabase al cargar el módulo: se fija antes del import.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
const { AdminProductList } = await import("./AdminProductList");

function product(overrides: Partial<AdminProductRow>): AdminProductRow {
  return {
    id: "p1",
    slug: "dior-sauvage-edt",
    name: "Sauvage EDT",
    brand: "Dior",
    description: null,
    image_path: null,
    gender: null,
    is_featured: false,
    status: "inactive",
    product_variants: [],
    ...overrides,
  };
}

const group = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

describe("AdminProductList", () => {
  it("sin productos invita a cargar el primero", () => {
    render(<AdminProductList products={[]} />);
    expect(screen.getByText("Todavía no hay productos. Cargá el primero con NUEVO PRODUCTO.")).toBeTruthy();
  });

  it("agrupa No publicados arriba y Publicados abajo, con la cantidad", () => {
    render(
      <AdminProductList
        products={[
          product({ id: "a", status: "active", image_path: "a.webp" }),
          product({ id: "b", brand: "Creed", name: "Aventus" }),
        ]}
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["No publicados (1)", "Publicados (1)"]);
    expect(within(group("No publicados")).getByText("Creed · Aventus")).toBeTruthy();
  });

  it("sin un grupo no muestra su título", () => {
    render(<AdminProductList products={[product({})]} />);
    expect(screen.queryByRole("heading", { name: /^Publicados/ })).toBeNull();
  });

  it("cada fila es un link a la ficha con el estado en texto", () => {
    render(<AdminProductList products={[product({ id: "abc" })]} />);
    const link = screen.getByRole("link", { name: /Dior · Sauvage EDT/ });
    expect(link.getAttribute("href")).toBe("/admin/productos/abc");
    expect(within(link).getByText("No publicado")).toBeTruthy();
  });

  it("dice qué falta, las presentaciones con stock y si es destacado", () => {
    render(
      <AdminProductList
        products={[
          product({
            is_featured: true,
            product_variants: [
              { id: "v", variant_type: "decant", size_ml: 5, label: "Decant 5 ml", price: 1, stock: 3, is_available: true },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("Falta foto · Decant 5 ml · 3 u. · Destacado")).toBeTruthy();
  });

  it("sin foto muestra el recuadro; con foto, una imagen decorativa", () => {
    render(
      <AdminProductList
        products={[product({ id: "a" }), product({ id: "b", status: "active", image_path: "b.webp" })]}
      />,
    );
    expect(within(group("No publicados")).getByText("Sin foto")).toBeTruthy();
    // alt="": el nombre ya está en la fila; el lector de pantalla no la repite.
    expect(within(group("Publicados")).getByRole("presentation").getAttribute("alt")).toBe("");
  });
});
