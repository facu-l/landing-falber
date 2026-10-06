// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/catalog";
import { requestPrefill } from "./prefill";

const variant = (over: Partial<CatalogVariant>): CatalogVariant => ({
  id: "v",
  variantType: "decant",
  sizeMl: 5,
  label: "Decant 5 ml",
  price: 1000,
  inStock: false,
  ...over,
});

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  id: "p",
  slug: "azzaro-the-most-wanted",
  name: "The Most Wanted",
  brand: "Azzaro",
  description: null,
  imagePath: null,
  gender: "male",
  isFeatured: false,
  variants: [variant({ id: "frasco", variantType: "full_bottle", sizeMl: 100, label: "Frasco 100 ml" })],
  ...over,
});

const catalog = [
  product({}),
  product({
    slug: "dior-sauvage-edt",
    name: "Sauvage EDT",
    brand: "Dior",
    variants: [
      variant({ id: "frasco", variantType: "full_bottle", sizeMl: 100, label: "Frasco 100 ml" }),
      variant({ id: "d10", sizeMl: 10, label: "Decant 10 ml" }),
      variant({ id: "d5", sizeMl: 5, label: "Decant 5 ml", inStock: true }),
    ],
  }),
];

describe("requestPrefill", () => {
  it("precarga perfume, marca y las presentaciones sin stock", () => {
    expect(requestPrefill(catalog, "azzaro-the-most-wanted")).toEqual({
      perfumeName: "The Most Wanted",
      brand: "Azzaro",
      variants: [{ id: "frasco", label: "Frasco 100 ml" }],
    });
  });

  it("ofrece solo las presentaciones sin stock, en el orden del detalle (decants primero)", () => {
    expect(requestPrefill(catalog, "dior-sauvage-edt")?.variants).toEqual([
      { id: "d10", label: "Decant 10 ml" },
      { id: "frasco", label: "Frasco 100 ml" },
    ]);
  });

  it.each([
    ["sin parámetro", undefined],
    ["vacío", ""],
    // El catálogo solo trae productos activos: un inactivo es igual a uno inexistente.
    ["un slug inexistente o inactivo", "producto-oculto"],
  ])("%s → encargo libre (null)", (_, param) => {
    expect(requestPrefill(catalog, param)).toBeNull();
  });

  it("con el parámetro repetido usa el primero", () => {
    expect(requestPrefill(catalog, ["dior-sauvage-edt", "azzaro-the-most-wanted"])?.brand).toBe("Dior");
  });
});
