import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CART_STORAGE_KEY, serializeCart } from "@/lib/cart/cart";
import type { VariantIndex } from "@/lib/cart/resolve";
import { CartView } from "./CartView";

const SAUVAGE_5 = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const SAUVAGE_100 = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";
const GONE = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c03";

const sauvage = { productName: "Sauvage EDT", brand: "Dior", slug: "dior-sauvage-edt", imagePath: null };
const index: VariantIndex = {
  [SAUVAGE_5]: { ...sauvage, label: "Decant 5 ml", price: 10000, inStock: true },
  [SAUVAGE_100]: { ...sauvage, label: "Frasco 100 ml", price: 250000, inStock: false },
};

afterEach(() => localStorage.clear());

function withCart(lines: { variantId: string; quantity: number }[]) {
  localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
}

const storedCart = () => JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]");

describe("CartView", () => {
  it("vacío invita a ver el catálogo", () => {
    render(<CartView index={index} />);
    expect(screen.getByText("Tu carrito está vacío.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver catálogo" }).getAttribute("href")).toBe("/catalogo");
  });

  it("muestra cada producto con el precio del catálogo y el total estimado", () => {
    withCart([{ variantId: SAUVAGE_5, quantity: 2 }]);
    render(<CartView index={index} />);

    const item = screen.getByRole("listitem");
    expect(item.textContent).toMatch("Sauvage EDT");
    expect(item.textContent).toMatch("Decant 5 ml");
    expect(screen.getByRole("link", { name: /Sauvage EDT/ }).getAttribute("href")).toBe("/producto/dior-sauvage-edt");
    expect(screen.getByTestId("cart-total").textContent).toMatch(/\$\s?20\.000/);
  });

  it("cambiar la cantidad actualiza el carrito y el total", () => {
    withCart([{ variantId: SAUVAGE_5, quantity: 1 }]);
    render(<CartView index={index} />);

    fireEvent.change(screen.getByLabelText(/Cantidad/), { target: { value: "3" } });
    expect(storedCart()).toEqual([{ variantId: SAUVAGE_5, quantity: 3 }]);
    expect(screen.getByTestId("cart-total").textContent).toMatch(/\$\s?30\.000/);
  });

  it("quitar saca el producto", () => {
    withCart([{ variantId: SAUVAGE_5, quantity: 1 }]);
    render(<CartView index={index} />);

    fireEvent.click(screen.getByRole("button", { name: /Quitar Sauvage EDT/ }));
    expect(storedCart()).toEqual([]);
    expect(screen.getByText("Tu carrito está vacío.")).toBeTruthy();
  });

  it("avisa de un producto sin stock", () => {
    withCart([{ variantId: SAUVAGE_100, quantity: 1 }]);
    render(<CartView index={index} />);
    expect(screen.getByRole("listitem").textContent).toMatch("Sin stock");
  });

  it("avisa de productos que ya no están disponibles y permite quitarlos", () => {
    withCart([
      { variantId: SAUVAGE_5, quantity: 1 },
      { variantId: GONE, quantity: 1 },
    ]);
    render(<CartView index={index} />);

    expect(screen.getByRole("alert").textContent).toMatch("ya no está disponible");
    fireEvent.click(screen.getByRole("button", { name: "Quitar los no disponibles" }));
    expect(storedCart()).toEqual([{ variantId: SAUVAGE_5, quantity: 1 }]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
