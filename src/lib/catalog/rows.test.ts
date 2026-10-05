// @vitest-environment node
import { expect, it } from "vitest";
import { type CatalogRow, toCatalogProducts } from "./rows";

const row = (overrides: Partial<CatalogRow> = {}): CatalogRow => ({
  id: "p1",
  slug: "dior-sauvage-edt",
  name: "Sauvage EDT",
  brand: "Dior",
  description: null,
  image_path: "dior-sauvage-edt.webp",
  gender: "male",
  is_featured: true,
  product_variants: [
    { id: "v1", variant_type: "decant", size_ml: 5, label: "Decant 5 ml", price: 14500, stock: 3, is_available: true },
    { id: "v2", variant_type: "decant", size_ml: 10, label: "Decant 10 ml", price: 26000, stock: 0, is_available: true },
  ],
  ...overrides,
});

it("traduce la fila al modelo de la UI y calcula inStock", () => {
  const [p] = toCatalogProducts([row()]);
  expect(p).toMatchObject({ slug: "dior-sauvage-edt", imagePath: "dior-sauvage-edt.webp", isFeatured: true });
  expect(p.variants.map((v) => [v.label, v.inStock])).toEqual([
    ["Decant 5 ml", true],
    ["Decant 10 ml", false],
  ]);
});

it("oculta las variantes con is_available = false", () => {
  const [p] = toCatalogProducts([
    row({
      product_variants: [
        { id: "v1", variant_type: "decant", size_ml: 5, label: "Decant 5 ml", price: 14500, stock: 3, is_available: false },
        { id: "v2", variant_type: "decant", size_ml: 10, label: "Decant 10 ml", price: 26000, stock: 2, is_available: true },
      ],
    }),
  ]);
  expect(p.variants.map((v) => v.id)).toEqual(["v2"]);
});

it("un producto sin variantes visibles queda fuera de la tienda", () => {
  expect(toCatalogProducts([row({ product_variants: [] })])).toEqual([]);
});
