// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog/catalog";
import { PRIVATE_PATHS, SITE_URL, organizationJsonLd, productJsonLd, robotsRules, sitemapEntries } from "./seo";

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
      { id: "v-frasco", variantType: "full_bottle", sizeMl: 100, label: "Frasco 100 ml", price: 250000, inStock: false },
      { id: "v-decant", variantType: "decant", sizeMl: 5, label: "Decant 5 ml", price: 12500, inStock: true },
    ],
    ...overrides,
  };
}

const urls = (slugs: string[]) => sitemapEntries(slugs.map((slug) => ({ slug }))).map((e) => e.url);

describe("sitemapEntries", () => {
  it("lista las páginas públicas aunque no haya productos", () => {
    expect(urls([])).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/catalogo`,
      `${SITE_URL}/encargos`,
      `${SITE_URL}/cambios-y-devoluciones`,
    ]);
  });

  it("agrega una URL por producto con su slug", () => {
    expect(urls(["dior-sauvage-edt", "afnan-9pm-night-out"])).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/producto/dior-sauvage-edt`,
        `${SITE_URL}/producto/afnan-9pm-night-out`,
      ]),
    );
  });

  it("no repite URLs aunque el catálogo traiga un slug dos veces", () => {
    const list = urls(["hawas-ice", "hawas-ice"]);
    expect(new Set(list).size).toBe(list.length);
  });

  it("nunca incluye una ruta privada", () => {
    for (const url of urls(["hawas-ice"])) {
      const path = new URL(url).pathname;
      expect(PRIVATE_PATHS.some((p) => path.startsWith(p))).toBe(false);
    }
  });
});

describe("robotsRules", () => {
  it("permite la tienda, bloquea cada ruta privada y apunta al sitemap", () => {
    const robots = robotsRules();
    expect(robots.rules).toEqual({ userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] });
    expect(robots.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("bloquea el admin, el carrito, el checkout y los pedidos", () => {
    expect(PRIVATE_PATHS).toEqual(["/admin", "/carrito", "/checkout", "/pedido"]);
  });
});

describe("organizationJsonLd", () => {
  it("es una Organization con nombre, URL del sitio y redes", () => {
    const org = organizationJsonLd();
    expect(org).toMatchObject({ "@type": "Organization", name: "FALBER", url: SITE_URL });
    expect(org.sameAs.length).toBeGreaterThan(0);
  });
});

describe("productJsonLd", () => {
  it("arma un Product con un Offer por presentación, decants primero", () => {
    const json = productJsonLd(product(), "https://img.test/sauvage.webp");
    expect(json).toMatchObject({ "@type": "Product", name: "Sauvage EDT", image: "https://img.test/sauvage.webp" });
    expect(json.offers.map((o) => o.sku)).toEqual(["v-decant", "v-frasco"]);
  });

  it("usa la disponibilidad real de cada presentación", () => {
    const [decant, frasco] = productJsonLd(product(), null).offers;
    expect(decant).toMatchObject({ availability: "https://schema.org/InStock", priceCurrency: "ARS", price: 12500 });
    expect(frasco).toMatchObject({ availability: "https://schema.org/OutOfStock", price: 250000 });
  });

  it("completa la descripción si el producto no tiene", () => {
    const json = productJsonLd(product({ description: null }), null);
    expect(json.description).toBe("Sauvage EDT de Dior. Decants y perfumes FALBER.");
  });

  it("omite la imagen si el producto no tiene foto", () => {
    const json = productJsonLd(product(), null);
    expect(json).not.toHaveProperty("image");
  });
});
