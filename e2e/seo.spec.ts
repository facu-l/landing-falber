import { expect, test } from "@playwright/test";

// Las reglas están probadas en src/lib/seo/seo.test.ts; esto prueba que Next sirve los
// archivos y que el sitemap sale del catálogo real (solo productos activos del seed).

test("robots.txt bloquea las rutas privadas y apunta al sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  for (const path of ["/admin", "/carrito", "/checkout", "/pedido"]) {
    expect(body).toContain(`Disallow: ${path}`);
  }
  expect(body).toContain("Sitemap: https://falber.com.ar/sitemap.xml");
});

test("sitemap.xml lista los productos activos y no los ocultos", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("<loc>https://falber.com.ar/catalogo</loc>");
  expect(body).toContain("<loc>https://falber.com.ar/producto/dior-sauvage-edt</loc>");
  expect(body).not.toContain("producto-oculto");
  expect(body).not.toContain("/admin");
});
