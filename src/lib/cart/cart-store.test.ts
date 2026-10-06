import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY, serializeCart } from "./cart";
import { addItem, clearCart, removeItem, updateQuantity, useCart } from "./cart-store";

const A = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const B = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// Lo que hace el navegador cuando OTRA pestaña escribe en localStorage.
function otherTabWrites(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
}

describe("useCart", () => {
  it("arranca vacío", () => {
    const { result } = renderHook(() => useCart());
    expect(result.current).toEqual([]);
  });

  it("lee lo que ya estaba guardado", () => {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart([{ variantId: A, quantity: 2 }]));
    const { result } = renderHook(() => useCart());
    expect(result.current).toEqual([{ variantId: A, quantity: 2 }]);
  });

  it("con datos rotos arranca vacío, sin fallar", () => {
    localStorage.setItem(CART_STORAGE_KEY, "{roto");
    const { result } = renderHook(() => useCart());
    expect(result.current).toEqual([]);
  });

  it("se actualiza al agregar y lo guarda en localStorage", () => {
    const { result } = renderHook(() => useCart());
    let outcome;
    act(() => {
      outcome = addItem(A, 2);
    });
    expect(outcome).toBe("added");
    expect(result.current).toEqual([{ variantId: A, quantity: 2 }]);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([{ variantId: A, quantity: 2 }]);
  });

  it("cambia cantidades, saca líneas y se vacía", () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      addItem(A, 1);
      addItem(B, 1);
      updateQuantity(A, 3);
    });
    expect(result.current).toEqual([
      { variantId: A, quantity: 3 },
      { variantId: B, quantity: 1 },
    ]);
    act(() => removeItem(A));
    expect(result.current).toEqual([{ variantId: B, quantity: 1 }]);
    act(() => clearCart());
    expect(result.current).toEqual([]);
  });

  it("se sincroniza cuando otra pestaña cambia el carrito", () => {
    const { result } = renderHook(() => useCart());
    act(() => otherTabWrites(CART_STORAGE_KEY, serializeCart([{ variantId: B, quantity: 4 }])));
    expect(result.current).toEqual([{ variantId: B, quantity: 4 }]);
  });

  it("devuelve la misma referencia si nada cambió (si no, React re-renderiza sin fin)", () => {
    localStorage.setItem(CART_STORAGE_KEY, serializeCart([{ variantId: A, quantity: 1 }]));
    const { result, rerender } = renderHook(() => useCart());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("sin localStorage (ej. bloqueado por el navegador) funciona en memoria", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useCart());
    act(() => {
      addItem(A, 1);
    });
    expect(result.current).toEqual([{ variantId: A, quantity: 1 }]);
    act(() => clearCart());
  });
});
