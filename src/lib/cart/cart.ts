import { z } from "zod";

/*
 * Reglas puras del carrito. El carrito vive en localStorage y guarda SOLO
 * variant_id + cantidad: nunca precios, que siempre salen del servidor.
 *
 * Los límites repiten los de create_order (la base es la que manda): así el
 * cliente ve el aviso al agregar, no un error al confirmar la compra.
 */

export const MAX_QUANTITY = 10;
export const MAX_LINES = 20;

// Con versión: si el formato cambia, una clave nueva evita leer carritos viejos.
export const CART_STORAGE_KEY = "falber:cart:v1";

export type CartLine = { readonly variantId: string; readonly quantity: number };
export type Cart = readonly CartLine[];

export type AddOutcome = "added" | "limit_reached" | "cart_full";

export function addToCart(cart: Cart, variantId: string, quantity = 1): { cart: Cart; outcome: AddOutcome } {
  const existing = cart.find((line) => line.variantId === variantId);

  if (!existing) {
    if (cart.length >= MAX_LINES) return { cart, outcome: "cart_full" };
    return { cart: [...cart, { variantId, quantity: clampQuantity(quantity) }], outcome: "added" };
  }

  const wanted = existing.quantity + quantity;
  return {
    cart: setQuantity(cart, variantId, wanted),
    outcome: wanted > MAX_QUANTITY ? "limit_reached" : "added",
  };
}

export function setQuantity(cart: Cart, variantId: string, quantity: number): Cart {
  if (quantity < 1) return removeFromCart(cart, variantId);
  return cart.map((line) =>
    line.variantId === variantId ? { variantId, quantity: clampQuantity(quantity) } : line,
  );
}

export function removeFromCart(cart: Cart, variantId: string): Cart {
  return cart.filter((line) => line.variantId !== variantId);
}

export function cartCount(cart: Cart): number {
  return cart.reduce((total, line) => total + line.quantity, 0);
}

export function serializeCart(cart: Cart): string {
  return JSON.stringify(cart);
}

const storedLine = z.object({
  variantId: z.uuid(),
  quantity: z.int().min(1),
});

/*
 * Lo guardado en localStorage no es confiable: puede estar roto, ser de una versión
 * vieja o editado a mano. Nunca falla: descarta lo inválido y conserva el resto.
 */
export function parseCart(raw: string | null): Cart {
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  let cart: Cart = [];
  for (const item of data) {
    const line = storedLine.safeParse(item);
    if (line.success) cart = addToCart(cart, line.data.variantId, line.data.quantity).cart;
  }
  return cart;
}

function clampQuantity(quantity: number): number {
  return Math.min(Math.floor(quantity), MAX_QUANTITY);
}
