import type { CatalogProduct } from "@/lib/catalog/catalog";
import type { Cart } from "./cart";

/*
 * Cruza el carrito (solo variant_id + cantidad) con el catálogo del servidor.
 * Los precios salen siempre de acá: el carrito nunca los guarda.
 * El total es "estimado": el precio final lo fija create_order al confirmar.
 */

export type VariantInfo = {
  productName: string;
  brand: string;
  slug: string;
  imagePath: string | null;
  label: string;
  price: number;
  inStock: boolean;
};

export type VariantIndex = Record<string, VariantInfo>;

export type CartItemView = VariantInfo & {
  variantId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ResolvedCart = {
  items: CartItemView[];
  /** Variantes del carrito que ya no están en el catálogo (borradas, inactivas o producto oculto). */
  missing: string[];
  /** Solo las líneas con stock. */
  total: number;
  canCheckout: boolean;
};

export function buildVariantIndex(products: CatalogProduct[]): VariantIndex {
  const index: VariantIndex = {};
  for (const p of products) {
    for (const v of p.variants) {
      index[v.id] = {
        productName: p.name,
        brand: p.brand,
        slug: p.slug,
        imagePath: p.imagePath,
        label: v.label,
        price: v.price,
        inStock: v.inStock,
      };
    }
  }
  return index;
}

export function resolveCart(cart: Cart, index: VariantIndex): ResolvedCart {
  const items: CartItemView[] = [];
  const missing: string[] = [];

  for (const { variantId, quantity } of cart) {
    const info = index[variantId];
    if (!info) {
      missing.push(variantId);
      continue;
    }
    items.push({ ...info, variantId, quantity, unitPrice: info.price, lineTotal: info.price * quantity });
  }

  const total = items.filter((i) => i.inStock).reduce((sum, i) => sum + i.lineTotal, 0);
  const canCheckout = items.length > 0 && missing.length === 0 && items.every((i) => i.inStock);

  return { items, missing, total, canCheckout };
}
