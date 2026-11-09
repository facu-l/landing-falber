// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog/catalog";
import { escapeXml, merchantFeedXml, merchantItems } from "./merchant-feed";
import { SITE_URL } from "./seo";

const imageUrl = (path: string | null) => (path ? `https://img.test/${path}` : null);

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "p1",
    slug: "dior-sauvage-edt",
    name: "Sauvage EDT",
    brand: "Dior",
    description: "Fresco y especiado.",
    imagePath: "dior/sauvage.webp",
    gender: "male",
    isFeatured: false,
    variants: [
      // Labels como los del seed: ya traen el tipo.
      { id: "v-frasco", variantType: "full_bottle", sizeMl: 100, label: "Frasco 100 ml", price: 250000, inStock: false },
      { id: "v-decant", variantType: "decant", sizeMl: 5, label: "Decant 5 ml", price: 12500, inStock: true },
    ],
    ...overrides,
  };
}

describe("merchantItems", () => {
  it("arma un ítem por presentación, agrupado por producto, decants primero", () => {
    const items = merchantItems([product()], imageUrl);
    expect(items.map((i) => i.id)).toEqual(["v-decant", "v-frasco"]);
    expect(items.every((i) => i.itemGroupId === "p1")).toBe(true);
  });

  it("usa precio en ARS con dos decimales y la disponibilidad de cada presentación", () => {
    const [decant, frasco] = merchantItems([product()], imageUrl);
    expect(decant).toMatchObject({ price: "12500.00 ARS", availability: "in_stock" });
    expect(frasco).toMatchObject({ price: "250000.00 ARS", availability: "out_of_stock" });
  });

  it("enlaza a la ficha del producto en el dominio canónico", () => {
    const [item] = merchantItems([product()], imageUrl);
    expect(item.link).toBe(`${SITE_URL}/producto/dior-sauvage-edt`);
    expect(item.title).toBe("Dior Sauvage EDT - Decant 5 ml");
  });

  it("deja afuera los productos sin foto (Google los rechazaría)", () => {
    expect(merchantItems([product({ imagePath: null })], imageUrl)).toEqual([]);
  });

  it("completa la descripción si el producto no tiene", () => {
    const [item] = merchantItems([product({ description: null })], imageUrl);
    expect(item.description).toBe("Sauvage EDT de Dior. Decants y perfumes FALBER.");
  });
});

describe("merchantFeedXml", () => {
  it("es un RSS con el namespace de Google y un <item> por presentación", () => {
    const xml = merchantFeedXml([product()], imageUrl);
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<g:condition>new</g:condition>");
  });

  it("omite g:gender si el producto no tiene género", () => {
    expect(merchantFeedXml([product({ gender: null })], imageUrl)).not.toContain("g:gender");
  });

  it("escapa los caracteres especiales de XML", () => {
    const xml = merchantFeedXml([product({ brand: "Dolce & Gabbana" })], imageUrl);
    expect(xml).toContain("<g:brand>Dolce &amp; Gabbana</g:brand>");
    expect(escapeXml(`<"'>`)).toBe("&lt;&quot;&apos;&gt;");
  });
});
