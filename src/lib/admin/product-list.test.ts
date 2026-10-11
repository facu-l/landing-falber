import { describe, expect, it } from "vitest";
import {
  type AdminProductRow,
  featuredSummary,
  groupProductsForAdmin,
  isDuplicateSlugError,
  missingForPublish,
  NEW_PRODUCT_ERRORS,
  parseNewProduct,
  slugify,
  variantSummaries,
} from "./product-list";

// El check de products.slug en 0001: lo que slugify devuelva tiene que pasarlo.
const SLUG_CHECK = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function row(overrides: Partial<AdminProductRow> = {}): AdminProductRow {
  return {
    id: "p1",
    slug: "dior-sauvage-edt",
    name: "Sauvage EDT",
    brand: "Dior",
    description: null,
    image_path: "dior-sauvage-edt.webp",
    gender: "male",
    is_featured: false,
    status: "active",
    product_variants: [
      { id: "v1", variant_type: "decant", size_ml: 5, label: "Decant 5 ml", price: 14500, stock: 3, is_available: true },
    ],
    ...overrides,
  };
}

describe("slugify", () => {
  it("arma marca-nombre como el seed", () => {
    expect(slugify("Dior", "Sauvage EDT")).toBe("dior-sauvage-edt");
    expect(slugify("Maison Francis Kurkdjian", "Baccarat Rouge 540")).toBe("maison-francis-kurkdjian-baccarat-rouge-540");
  });

  it("saca tildes, signos y espacios de más", () => {
    expect(slugify("  Carolina Herrera ", "212 V.I.P. Rosé  ")).toBe("carolina-herrera-212-v-i-p-rose");
    expect(slugify("Dolce & Gabbana", "Light Blue (Pour Homme)")).toBe("dolce-gabbana-light-blue-pour-homme");
    expect(slugify("Ñandú", "Señorita")).toBe("nandu-senorita");
  });

  it("siempre pasa el check de la base (o queda vacío)", () => {
    for (const [brand, name] of [
      ["Dior", "Sauvage"],
      ["--", "!!"],
      ["A", "--b--"],
      ["Ünïcödé", "Ça va"],
    ]) {
      const slug = slugify(brand, name);
      expect(slug === "" || SLUG_CHECK.test(slug)).toBe(true);
    }
  });
});

describe("parseNewProduct", () => {
  it("recorta y devuelve marca, nombre y slug", () => {
    expect(parseNewProduct({ brand: "  Dior ", name: " Sauvage EDT " })).toEqual({
      success: true,
      data: { brand: "Dior", name: "Sauvage EDT", slug: "dior-sauvage-edt" },
    });
  });

  it("marca y nombre son obligatorios", () => {
    expect(parseNewProduct({ brand: " ", name: "" })).toEqual({
      success: false,
      fieldErrors: { brand: NEW_PRODUCT_ERRORS.brandRequired, name: NEW_PRODUCT_ERRORS.nameRequired },
    });
  });

  it("respeta los largos de la base (nombre 2 a 120, marca hasta 60)", () => {
    expect(parseNewProduct({ brand: "Dior", name: "S" })).toMatchObject({
      fieldErrors: { name: NEW_PRODUCT_ERRORS.nameLength },
    });
    expect(parseNewProduct({ brand: "Dior", name: "x".repeat(121) })).toMatchObject({
      fieldErrors: { name: NEW_PRODUCT_ERRORS.nameLength },
    });
    expect(parseNewProduct({ brand: "x".repeat(61), name: "Sauvage" })).toMatchObject({
      fieldErrors: { brand: NEW_PRODUCT_ERRORS.brandLength },
    });
    expect(parseNewProduct({ brand: "x".repeat(60), name: "x".repeat(120) }).success).toBe(true);
  });

  it("sin letras ni números no hay link posible: lo marca en el nombre", () => {
    expect(parseNewProduct({ brand: "--", name: "!!" })).toEqual({
      success: false,
      fieldErrors: { name: NEW_PRODUCT_ERRORS.noSlug },
    });
  });
});

describe("isDuplicateSlugError", () => {
  it("reconoce el unique del slug por código y constraint", () => {
    expect(
      isDuplicateSlugError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "products_slug_key"',
      }),
    ).toBe(true);
  });

  it("no confunde otro unique ni otro error", () => {
    expect(isDuplicateSlugError({ code: "23505", message: 'violates unique constraint "otro_key"' })).toBe(false);
    expect(isDuplicateSlugError({ code: "23514", message: "products_slug_key" })).toBe(false);
  });
});

describe("missingForPublish", () => {
  it("vacío si tiene foto y una presentación disponible", () => {
    expect(missingForPublish(row())).toEqual([]);
  });

  it("pide foto si no hay o está en blanco", () => {
    expect(missingForPublish(row({ image_path: null }))).toEqual(["image"]);
    expect(missingForPublish(row({ image_path: "  " }))).toEqual(["image"]);
  });

  it("una presentación no disponible no cuenta (como en guard_product_publish)", () => {
    const unavailable = row().product_variants.map((v) => ({ ...v, is_available: false }));
    expect(missingForPublish(row({ product_variants: unavailable }))).toEqual(["variant"]);
    expect(missingForPublish(row({ image_path: null, product_variants: [] }))).toEqual(["image", "variant"]);
  });

  it("sin stock igual se publica (agotado lleva a Encargar)", () => {
    const soldOut = row().product_variants.map((v) => ({ ...v, stock: 0 }));
    expect(missingForPublish(row({ product_variants: soldOut }))).toEqual([]);
  });
});

describe("variantSummaries", () => {
  it("decants primero y por tamaño, con stock o agotado; las no disponibles no se listan", () => {
    const variants: AdminProductRow["product_variants"] = [
      { id: "a", variant_type: "full_bottle", size_ml: 100, label: "Frasco 100 ml", price: 1, stock: 0, is_available: true },
      { id: "b", variant_type: "decant", size_ml: 10, label: "Decant 10 ml", price: 1, stock: 2, is_available: true },
      { id: "c", variant_type: "decant", size_ml: 5, label: "Decant 5 ml", price: 1, stock: 1, is_available: true },
      { id: "d", variant_type: "decant", size_ml: 3, label: "Decant 3 ml", price: 1, stock: 9, is_available: false },
    ];
    expect(variantSummaries(variants)).toEqual(["Decant 5 ml · 1 u.", "Decant 10 ml · 2 u.", "Frasco 100 ml · agotado"]);
  });
});

describe("groupProductsForAdmin", () => {
  it("separa no publicados y publicados, cada grupo por marca y nombre", () => {
    const products = [
      row({ id: "1", brand: "Tom Ford", name: "Oud Wood", status: "active" }),
      row({ id: "2", brand: "Azzaro", name: "Wanted", status: "inactive" }),
      row({ id: "3", brand: "Árabe", name: "Zeta", status: "active" }),
      row({ id: "4", brand: "Árabe", name: "Alfa", status: "active" }),
    ];
    const { unpublished, published } = groupProductsForAdmin(products);
    expect(unpublished.map((p) => p.id)).toEqual(["2"]);
    // "Árabe" va con la A, no después de la Z.
    expect(published.map((p) => p.id)).toEqual(["4", "3", "1"]);
  });
});

describe("featuredSummary", () => {
  it("sin destacados lo dice", () => {
    expect(featuredSummary([row()])).toBe("Sin destacados.");
  });

  it("cuenta todos los destacados y nombra los que muestra la home (publicados, con stock, máx. 3)", () => {
    const products = [
      row({ id: "1", brand: "A", name: "Uno", is_featured: true }),
      row({ id: "2", brand: "B", name: "Dos", is_featured: true, status: "inactive" }),
      row({ id: "3", brand: "C", name: "Tres", is_featured: true }),
      row({
        id: "4",
        brand: "D",
        name: "Agotado",
        is_featured: true,
        product_variants: row().product_variants.map((v) => ({ ...v, stock: 0 })),
      }),
      row({ id: "5", brand: "E", name: "Cinco", is_featured: true }),
      row({ id: "6", brand: "F", name: "Seis", is_featured: true }),
    ];
    expect(featuredSummary(products)).toBe("Destacados: 6. La home muestra: A Uno, C Tres, E Cinco.");
  });

  it("si ninguno califica, explica por qué la home no muestra ninguno", () => {
    expect(featuredSummary([row({ is_featured: true, status: "inactive" })])).toBe(
      "Destacados: 1. La home no muestra ninguno: hace falta que estén publicados y con stock.",
    );
  });
});
