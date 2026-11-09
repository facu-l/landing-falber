// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PRIVATE_PATHS, SITE_URL, robotsRules, sitemapEntries } from "./seo";

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
