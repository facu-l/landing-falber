import { expect, test } from "@playwright/test";

// Smoke de la Fase 1: la app levanta con el design system aplicado.
// Los flujos reales (compra completa, protección de /admin) llegan en las fases 3 y 5.

test("la home renderiza FALBER con el tema Noir", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/FALBER/);
  await expect(page.getByRole("heading", { level: 1, name: "FALBER" })).toBeVisible();

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("lang", "es-AR");

  // El token surface de Noir (#0b0c0e) llega al fondo de la página.
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(11, 12, 14)");
});

// Sin scroll horizontal no alcanza: el nav del header puede desbordar sin agrandar la página.
test("el header entra entero en la pantalla", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });
  const box = (await nav.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});

test("el hero no desborda el ancho en mobile", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
