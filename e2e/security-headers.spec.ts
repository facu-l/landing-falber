import { expect, test } from "@playwright/test";

// Ninguna página se puede embeber en un iframe de otro sitio (clickjacking sobre
// "Realizar compra"). HSTS y nosniff los agrega Netlify, por eso no se prueban acá.
for (const path of ["/", "/checkout", "/admin/login"]) {
  test(`${path} no se deja embeber y no filtra la URL completa`, async ({ request }) => {
    const response = await request.get(path);
    const headers = response.headers();

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
}
