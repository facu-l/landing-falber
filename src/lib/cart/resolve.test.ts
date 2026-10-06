// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog/catalog";
import { buildVariantIndex, resolveCart } from "./resolve";

const SAUVAGE_5 = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const SAUVAGE_100 = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";
const GONE = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c03";

const catalog: CatalogProduct[] = [
  {
    id: "p1",
    slug: "dior-sauvage-edt",
    name: "Sauvage EDT",
    brand: "Dior",
    description: null,
    imagePath: "sauvage.webp",
    gender: "male",
    isFeatured: false,
    variants: [
      { id: SAUVAGE_5, variantType: "decant", sizeMl: 5, label: "Decant 5 ml", price: 10000, inStock: true },
      { id: SAUVAGE_100, variantType: "full_bottle", sizeMl: 100, label: "Frasco 100 ml", price: 250000, inStock: false },
    ],
  },
];

describe("buildVariantIndex", () => {
  it("indexa cada variante con los datos de su producto", () => {
    expect(buildVariantIndex(catalog)[SAUVAGE_5]).toEqual({
      productName: "Sauvage EDT",
      brand: "Dior",
      slug: "dior-sauvage-edt",
      imagePath: "sauvage.webp",
      label: "Decant 5 ml",
      price: 10000,
      inStock: true,
    });
  });
});

describe("resolveCart", () => {
  const index = buildVariantIndex(catalog);

  it("arma cada línea con el precio del catálogo, no con el del carrito", () => {
    const resolved = resolveCart([{ variantId: SAUVAGE_5, quantity: 3 }], index);
    expect(resolved.items).toEqual([
      expect.objectContaining({ variantId: SAUVAGE_5, quantity: 3, unitPrice: 10000, lineTotal: 30000, inStock: true }),
    ]);
    expect(resolved.total).toBe(30000);
    expect(resolved.canCheckout).toBe(true);
  });

  it("una línea sin stock no suma al total y frena la compra", () => {
    const resolved = resolveCart(
      [
        { variantId: SAUVAGE_5, quantity: 1 },
        { variantId: SAUVAGE_100, quantity: 1 },
      ],
      index,
    );
    expect(resolved.items.map((i) => i.inStock)).toEqual([true, false]);
    expect(resolved.total).toBe(10000);
    expect(resolved.canCheckout).toBe(false);
  });

  it("separa las variantes que ya no existen o están inactivas y frena la compra", () => {
    const resolved = resolveCart(
      [
        { variantId: SAUVAGE_5, quantity: 1 },
        { variantId: GONE, quantity: 2 },
      ],
      index,
    );
    expect(resolved.items).toHaveLength(1);
    expect(resolved.missing).toEqual([GONE]);
    expect(resolved.canCheckout).toBe(false);
  });

  it("un carrito vacío no se puede comprar", () => {
    expect(resolveCart([], index)).toEqual({ items: [], missing: [], total: 0, canCheckout: false });
  });
});
