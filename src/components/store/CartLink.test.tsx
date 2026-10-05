import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CART_STORAGE_KEY, serializeCart } from "@/lib/cart/cart";
import { addItem } from "@/lib/cart/cart-store";
import { CartLink } from "./CartLink";

const A = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";

afterEach(() => localStorage.clear());

describe("CartLink", () => {
  it("lleva al carrito y sin productos no muestra cantidad", () => {
    render(<CartLink />);
    const link = screen.getByRole("link", { name: "Carrito" });
    expect(link.getAttribute("href")).toBe("/carrito");
  });

  it("muestra las unidades y se actualiza al agregar", () => {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart([{ variantId: A, quantity: 2 }]));
    render(<CartLink />);
    expect(screen.getByRole("link", { name: "Carrito, 2 unidades" })).toBeTruthy();

    act(() => {
      addItem(A, 1);
    });
    expect(screen.getByRole("link", { name: "Carrito, 3 unidades" })).toBeTruthy();
  });

  it("con una unidad usa el singular", () => {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart([{ variantId: A, quantity: 1 }]));
    render(<CartLink />);
    expect(screen.getByRole("link", { name: "Carrito, 1 unidad" })).toBeTruthy();
  });
});
