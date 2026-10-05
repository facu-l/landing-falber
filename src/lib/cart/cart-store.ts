import { useSyncExternalStore } from "react";
import {
  type AddOutcome,
  addToCart,
  type Cart,
  CART_STORAGE_KEY,
  parseCart,
  removeFromCart,
  serializeCart,
  setQuantity,
} from "./cart";

/*
 * Conecta las reglas puras del carrito (cart.ts) con localStorage.
 *
 * useSyncExternalStore porque localStorage es un estado externo a React:
 * - en el servidor (y en la hidratación) el carrito es vacío, sin desajustes;
 * - el evento "storage" sincroniza las otras pestañas abiertas;
 * - en la misma pestaña "storage" no se dispara, así que se avisa a mano (emit).
 */

const EMPTY: Cart = [];
const listeners = new Set<() => void>();

// Respaldo si localStorage no está disponible (bloqueado, modo privado o lleno).
let memoryRaw: string | null = null;

// getSnapshot tiene que devolver la misma referencia si nada cambió:
// se parsea de nuevo solo cuando cambia el texto guardado.
let lastRaw: string | null = null;
let lastCart: Cart = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function writeRaw(raw: string | null) {
  memoryRaw = raw;
  try {
    if (raw === null) localStorage.removeItem(CART_STORAGE_KEY);
    else localStorage.setItem(CART_STORAGE_KEY, raw);
  } catch {
    // Sin localStorage el carrito dura lo que dura la pestaña.
  }
  listeners.forEach((listener) => listener());
}

function getSnapshot(): Cart {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastCart = parseCart(raw);
  }
  return lastCart;
}

function getServerSnapshot(): Cart {
  return EMPTY;
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(change: (cart: Cart) => Cart) {
  writeRaw(serializeCart(change(getSnapshot())));
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function addItem(variantId: string, quantity = 1): AddOutcome {
  const result = addToCart(getSnapshot(), variantId, quantity);
  if (result.outcome !== "cart_full") writeRaw(serializeCart(result.cart));
  return result.outcome;
}

export function updateQuantity(variantId: string, quantity: number) {
  update((cart) => setQuantity(cart, variantId, quantity));
}

export function removeItem(variantId: string) {
  update((cart) => removeFromCart(cart, variantId));
}

export function clearCart() {
  writeRaw(null);
}
