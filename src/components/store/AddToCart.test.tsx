import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CART_STORAGE_KEY, MAX_LINES, MAX_QUANTITY, serializeCart } from "@/lib/cart/cart";
import type { CatalogVariant } from "@/lib/catalog/catalog";
import { AddToCart } from "./AddToCart";

const decant5: CatalogVariant = {
  id: "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01",
  variantType: "decant",
  sizeMl: 5,
  label: "Decant 5 ml",
  price: 10000,
  inStock: true,
};
const decant10: CatalogVariant = { ...decant5, id: "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02", sizeMl: 10, label: "Decant 10 ml", price: 18000 };
const bottle: CatalogVariant = {
  ...decant5,
  id: "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c03",
  variantType: "full_bottle",
  sizeMl: 100,
  label: "Frasco 100 ml",
  price: 250000,
  inStock: false,
};

afterEach(() => localStorage.clear());

function storedCart() {
  return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
}

describe("AddToCart", () => {
  it("muestra cada presentación con su precio; sin stock no se puede elegir", () => {
    render(<AddToCart variants={[bottle, decant5, decant10]} />);
    expect(screen.getByRole("radio", { name: /Decant 5 ml.*\$\s?10\.000/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Frasco 100 ml.*Sin stock/ })).toHaveProperty("disabled", true);
  });

  it("elige la primera presentación con stock por defecto", () => {
    render(<AddToCart variants={[bottle, decant5, decant10]} />);
    expect(screen.getByRole("radio", { name: /Decant 5 ml/ })).toHaveProperty("checked", true);
  });

  it("agrega la presentación elegida al carrito y lo confirma", () => {
    render(<AddToCart variants={[decant5, decant10]} />);
    fireEvent.click(screen.getByRole("radio", { name: /Decant 10 ml/ }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));

    expect(storedCart()).toEqual([{ variantId: decant10.id, quantity: 1 }]);
    expect(screen.getByRole("status").textContent).toMatch("Agregado al carrito");
    expect(screen.getByRole("link", { name: "Ver carrito" }).getAttribute("href")).toBe("/carrito");
  });

  it(`avisa cuando ya hay ${MAX_QUANTITY} unidades de esa presentación`, () => {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart([{ variantId: decant5.id, quantity: MAX_QUANTITY }]));
    render(<AddToCart variants={[decant5]} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));

    expect(screen.getByRole("status").textContent).toMatch(`máximo de ${MAX_QUANTITY} unidades`);
  });

  it(`avisa cuando el carrito ya tiene ${MAX_LINES} productos distintos`, () => {
    const full = Array.from({ length: MAX_LINES }, (_, i) => ({
      variantId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      quantity: 1,
    }));
    localStorage.setItem(CART_STORAGE_KEY, serializeCart(full));
    render(<AddToCart variants={[decant5]} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar al carrito" }));

    expect(storedCart()).toHaveLength(MAX_LINES);
    expect(screen.getByRole("status").textContent).toMatch(`${MAX_LINES} productos distintos`);
  });
});
