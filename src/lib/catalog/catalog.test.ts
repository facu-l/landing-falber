// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  type CatalogProduct,
  type CatalogVariant,
  brandsOf,
  featuredProducts,
  filterCatalog,
  fromPrice,
  isSoldOut,
  normalizeText,
  parseCatalogFilters,
  productsWithType,
  sortVariants,
} from "./catalog";

let nextId = 0;
function variant(overrides: Partial<CatalogVariant> = {}): CatalogVariant {
  return {
    id: `v${++nextId}`,
    variantType: "decant",
    sizeMl: 5,
    label: "Decant 5 ml",
    price: 10000,
    inStock: true,
    ...overrides,
  };
}

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: `p${++nextId}`,
    slug: "dior-sauvage-edt",
    name: "Sauvage EDT",
    brand: "Dior",
    description: null,
    imagePath: null,
    gender: "male",
    isFeatured: false,
    variants: [variant()],
    ...overrides,
  };
}

const sauvage = product({
  slug: "dior-sauvage-edt",
  isFeatured: true,
  variants: [
    variant({ sizeMl: 10, price: 26000 }),
    variant({ sizeMl: 5, price: 14500 }),
    variant({ variantType: "full_bottle", sizeMl: 100, price: 245000 }),
  ],
});
const baccarat = product({
  slug: "mfk-baccarat-rouge-540",
  name: "Baccarat Rouge 540",
  brand: "Maison Francis Kurkdjian",
  gender: "unisex",
  isFeatured: true,
});
const mostWanted = product({
  slug: "azzaro-the-most-wanted",
  name: "The Most Wanted",
  brand: "Azzaro",
  isFeatured: true,
  variants: [variant({ variantType: "full_bottle", sizeMl: 100, price: 168000, inStock: false })],
});
const catalog = [mostWanted, sauvage, baccarat];

describe("precios y stock", () => {
  it("fromPrice devuelve el precio más bajo con stock", () => {
    expect(fromPrice(sauvage)).toBe(14500);
  });

  it("fromPrice filtra por tipo de presentación", () => {
    expect(fromPrice(sauvage, "full_bottle")).toBe(245000);
    expect(fromPrice(baccarat, "full_bottle")).toBeNull();
  });

  it("fromPrice ignora una variante más barata sin stock", () => {
    const p = product({
      variants: [variant({ price: 5000, inStock: false }), variant({ sizeMl: 10, price: 9000 })],
    });
    expect(fromPrice(p)).toBe(9000);
  });

  it("un producto agotado igual muestra su precio", () => {
    expect(isSoldOut(mostWanted)).toBe(true);
    expect(fromPrice(mostWanted)).toBe(168000);
  });

  it("sortVariants pone decants primero y ordena por tamaño", () => {
    expect(sortVariants(sauvage.variants).map((v) => v.sizeMl)).toEqual([5, 10, 100]);
  });
});

describe("selecciones de la home", () => {
  it("un destacado agotado no se promociona", () => {
    expect(featuredProducts(catalog).map((p) => p.slug)).toEqual([
      "dior-sauvage-edt",
      "mfk-baccarat-rouge-540",
    ]);
  });

  it("featuredProducts respeta el límite", () => {
    expect(featuredProducts(catalog, 1)).toHaveLength(1);
  });

  it("productsWithType deja los agotados al final", () => {
    expect(productsWithType(catalog, "full_bottle").map((p) => p.slug)).toEqual([
      "dior-sauvage-edt",
      "azzaro-the-most-wanted",
    ]);
  });

  it("brandsOf devuelve marcas únicas en orden alfabético", () => {
    expect(brandsOf([...catalog, sauvage])).toEqual(["Azzaro", "Dior", "Maison Francis Kurkdjian"]);
  });
});

describe("filtros de /catalogo", () => {
  it("parseCatalogFilters lee los parámetros de la URL", () => {
    expect(
      parseCatalogFilters({ q: "  sauvage ", marca: "Dior", genero: "male", tipo: "decant" }),
    ).toEqual({ q: "sauvage", brand: "Dior", gender: "male", type: "decant" });
  });

  it("un valor inválido en la URL se ignora en vez de romper", () => {
    expect(parseCatalogFilters({ genero: "otro", tipo: "<script>" })).toEqual({
      q: "",
      brand: null,
      gender: null,
      type: null,
    });
  });

  it("si un parámetro viene repetido, usa el primero", () => {
    expect(parseCatalogFilters({ marca: ["Dior", "Creed"] }).brand).toBe("Dior");
  });

  it("la búsqueda ignora mayúsculas y tildes", () => {
    expect(normalizeText("Baccarát ROUGE")).toBe("baccarat rouge");
    const result = filterCatalog(catalog, parseCatalogFilters({ q: "báccarat" }));
    expect(result.map((p) => p.slug)).toEqual(["mfk-baccarat-rouge-540"]);
  });

  it("la búsqueda busca cada palabra en marca y nombre", () => {
    const result = filterCatalog(catalog, parseCatalogFilters({ q: "dior sauvage" }));
    expect(result.map((p) => p.slug)).toEqual(["dior-sauvage-edt"]);
  });

  it("el género es exacto: masculino no trae unisex", () => {
    const result = filterCatalog(catalog, parseCatalogFilters({ genero: "male" }));
    expect(result.map((p) => p.slug)).toEqual(["dior-sauvage-edt", "azzaro-the-most-wanted"]);
  });

  it("filtra por tipo y combina filtros", () => {
    const result = filterCatalog(catalog, parseCatalogFilters({ tipo: "full_bottle", marca: "Azzaro" }));
    expect(result.map((p) => p.slug)).toEqual(["azzaro-the-most-wanted"]);
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    expect(filterCatalog(catalog, parseCatalogFilters({ q: "inexistente" }))).toEqual([]);
  });
});
