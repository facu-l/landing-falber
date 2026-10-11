import { expect, test } from "@playwright/test";
import { createTestUser, signInAdmin } from "./admin-helpers";
import { randomDigits } from "./helpers";

/*
 * Alta de productos desde /admin/productos. Cada corrida deja un producto sin publicar:
 * no aparece en la tienda y la base no deja borrarlo (decisión 95). `npm run db:reset`
 * los limpia. El nombre lleva dígitos al azar para que el slug no choque entre corridas.
 */

test("un admin crea un producto y queda sin publicar, con lo que le falta a la vista", async ({ page }) => {
  const name = `Prueba ${randomDigits(6)}`;
  const slug = `falber-test-${name.toLowerCase().replace(" ", "-")}`;
  await signInAdmin(page, await createTestUser({ admin: true }));
  await expect(page).toHaveURL("/admin/pedidos");

  await page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "Productos" }).click();
  await expect(page.getByRole("heading", { name: "Productos", level: 1 })).toBeVisible();

  await page.getByText("Nuevo producto").click();
  await page.getByLabel("Marca").fill("FALBER Test");
  await page.getByLabel("Nombre").fill(name);
  await expect(page.getByLabel("Link")).toHaveValue(`/producto/${slug}`);
  await page.getByRole("button", { name: "Crear producto" }).click();

  // Va a su ficha, sin publicar. 15 s: con `next dev` la ficha se compila en la primera visita.
  await expect(page).toHaveURL(/\/admin\/productos\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  // Dentro del encabezado: Next deja la lista anterior montada y oculta (Activity), con sus badges.
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  await expect(header.getByRole("heading", { level: 1 })).toHaveText(`FALBER Test · ${name}`);
  await expect(header.getByText("No publicado")).toBeVisible();

  // En la lista, entre los no publicados, con lo que falta para publicarlo.
  await page.getByRole("link", { name: "Volver a productos" }).click();
  const row = page
    .getByRole("region", { name: /^No publicados/ })
    .getByRole("link", { name: new RegExp(`FALBER Test · ${name}`) });
  await expect(row).toContainText("Falta foto · Falta presentación");

  // Un segundo producto con el mismo link se rechaza en el campo Nombre.
  await page.getByText("Nuevo producto").click();
  await page.getByLabel("Marca").fill("FALBER Test");
  await page.getByLabel("Nombre").fill(name);
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page.getByLabel("Nombre")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Ya hay un producto con ese link")).toBeVisible();
  await expect(page).toHaveURL("/admin/productos");
});
