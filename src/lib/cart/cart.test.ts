// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addToCart,
  type Cart,
  cartCount,
  MAX_LINES,
  MAX_QUANTITY,
  parseCart,
  removeFromCart,
  serializeCart,
  setQuantity,
} from "./cart";

const A = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const B = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";

// 20 UUID v4 distintos para llenar el carrito.
const manyIds = Array.from({ length: MAX_LINES + 1 }, (_, i) =>
  `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);

describe("addToCart", () => {
  it("agrega una línea nueva", () => {
    expect(addToCart([], A, 2)).toEqual({ cart: [{ variantId: A, quantity: 2 }], outcome: "added" });
  });

  it("suma a la línea existente sin duplicarla", () => {
    const { cart } = addToCart([{ variantId: A, quantity: 2 }], A, 3);
    expect(cart).toEqual([{ variantId: A, quantity: 5 }]);
  });

  it(`no pasa de ${MAX_QUANTITY} unidades por presentación y lo avisa`, () => {
    expect(addToCart([{ variantId: A, quantity: 9 }], A, 3)).toEqual({
      cart: [{ variantId: A, quantity: MAX_QUANTITY }],
      outcome: "limit_reached",
    });
  });

  it(`con ${MAX_LINES} líneas no agrega otra y lo avisa`, () => {
    const full: Cart = manyIds.slice(0, MAX_LINES).map((variantId) => ({ variantId, quantity: 1 }));
    expect(addToCart(full, manyIds[MAX_LINES], 1)).toEqual({ cart: full, outcome: "cart_full" });
  });

  it("con el carrito lleno igual suma a una línea existente", () => {
    const full: Cart = manyIds.slice(0, MAX_LINES).map((variantId) => ({ variantId, quantity: 1 }));
    expect(addToCart(full, manyIds[0], 1).outcome).toBe("added");
  });

  it("no modifica el carrito recibido", () => {
    const cart: Cart = [{ variantId: A, quantity: 1 }];
    addToCart(cart, A, 1);
    expect(cart).toEqual([{ variantId: A, quantity: 1 }]);
  });
});

describe("setQuantity", () => {
  const cart: Cart = [
    { variantId: A, quantity: 2 },
    { variantId: B, quantity: 1 },
  ];

  it("cambia la cantidad de una línea", () => {
    expect(setQuantity(cart, A, 4)).toEqual([
      { variantId: A, quantity: 4 },
      { variantId: B, quantity: 1 },
    ]);
  });

  it(`limita a ${MAX_QUANTITY}`, () => {
    expect(setQuantity(cart, A, 50)[0].quantity).toBe(MAX_QUANTITY);
  });

  it("con 0 o menos saca la línea", () => {
    expect(setQuantity(cart, A, 0)).toEqual([{ variantId: B, quantity: 1 }]);
  });
});

describe("removeFromCart", () => {
  it("saca solo esa línea", () => {
    expect(removeFromCart([{ variantId: A, quantity: 2 }, { variantId: B, quantity: 1 }], A)).toEqual([
      { variantId: B, quantity: 1 },
    ]);
  });
});

describe("cartCount", () => {
  it("suma las unidades, no las líneas", () => {
    expect(cartCount([{ variantId: A, quantity: 2 }, { variantId: B, quantity: 3 }])).toBe(5);
    expect(cartCount([])).toBe(0);
  });
});

describe("parseCart", () => {
  it("lee lo que escribe serializeCart", () => {
    const cart: Cart = [{ variantId: A, quantity: 2 }];
    expect(parseCart(serializeCart(cart))).toEqual(cart);
  });

  it.each([
    ["nada guardado", null],
    ["JSON roto", "{no es json"],
    ["un objeto en vez de una lista", '{"variantId":"x"}'],
  ])("con %s devuelve un carrito vacío", (_, raw) => {
    expect(parseCart(raw)).toEqual([]);
  });

  it("descarta líneas inválidas y conserva las válidas", () => {
    const raw = JSON.stringify([
      { variantId: A, quantity: 2 },
      { variantId: "no-es-uuid", quantity: 1 },
      { variantId: B, quantity: 0 },
      { variantId: B, quantity: 1.5 },
      { variantId: B, price: 1 },
      null,
    ]);
    expect(parseCart(raw)).toEqual([{ variantId: A, quantity: 2 }]);
  });

  it("ignora campos de más (ej. un precio inyectado)", () => {
    const raw = JSON.stringify([{ variantId: A, quantity: 1, price: 1 }]);
    expect(parseCart(raw)).toEqual([{ variantId: A, quantity: 1 }]);
  });

  it(`une duplicados y respeta ${MAX_QUANTITY} y ${MAX_LINES} líneas`, () => {
    const raw = JSON.stringify([
      { variantId: A, quantity: 8 },
      { variantId: A, quantity: 8 },
      ...manyIds.map((variantId) => ({ variantId, quantity: 1 })),
    ]);
    const cart = parseCart(raw);
    expect(cart[0]).toEqual({ variantId: A, quantity: MAX_QUANTITY });
    expect(cart).toHaveLength(MAX_LINES);
  });
});
