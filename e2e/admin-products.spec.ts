import { expect, test } from "@playwright/test";
import { createTestUser, createUnpublishedProduct, signInAdmin } from "./admin-helpers";
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

  // Acotado al alta: Next deja montadas y ocultas las páginas visitadas (Activity), con sus campos.
  const newProduct = page.locator("details").filter({ hasText: "Nuevo producto" });
  await newProduct.getByText("Nuevo producto").click();
  await newProduct.getByLabel("Marca").fill("FALBER Test");
  await newProduct.getByLabel("Nombre").fill(name);
  await expect(newProduct.getByLabel("Link")).toHaveValue(`/producto/${slug}`);
  await newProduct.getByRole("button", { name: "Crear producto" }).click();

  // Va a su ficha, sin publicar. 15 s: con `next dev` la ficha se compila en la primera visita.
  // Llega con ?nuevo=1 y la página lo saca de la URL (recargar no repite el aviso).
  await expect(page).toHaveURL(/\/admin\/productos\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  // Dentro del encabezado: Next deja la lista anterior montada y oculta (Activity), con sus badges.
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  await expect(header.getByRole("heading", { level: 1 })).toHaveText(`FALBER Test · ${name}`);
  await expect(header.getByText("No publicado")).toBeVisible();
  await expect(header.getByText("Para publicar falta: foto · una presentación disponible")).toBeVisible();
  // D17: el foco quedó en el título del producto nuevo, y el aviso sigue a la vista.
  await expect(header.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(header.getByRole("status")).toHaveText("Producto creado. Cargale la foto y revisá los datos.");

  // En la lista, entre los no publicados, con lo que falta para publicarlo.
  await page.getByRole("link", { name: "Volver a productos" }).click();
  const row = page
    .getByRole("region", { name: /^No publicados/ })
    .getByRole("link", { name: new RegExp(`FALBER Test · ${name}`) });
  await expect(row).toContainText("Falta foto · Falta presentación");

  // Un segundo producto con el mismo link se rechaza en el campo Nombre.
  await newProduct.getByText("Nuevo producto").click();
  await newProduct.getByLabel("Marca").fill("FALBER Test");
  await newProduct.getByLabel("Nombre").fill(name);
  await newProduct.getByRole("button", { name: "Crear producto" }).click();
  await expect(newProduct.getByLabel("Nombre")).toHaveAttribute("aria-invalid", "true");
  await expect(newProduct.getByText("Ya hay un producto con ese link")).toBeVisible();
  await expect(page).toHaveURL("/admin/productos");
});

test("un admin corrige los datos: el link queda fijo y se guarda el destacado", async ({ page }) => {
  const [admin, product] = await Promise.all([createTestUser({ admin: true }), createUnpublishedProduct()]);
  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");
  await page.goto(`/admin/productos/${product.id}`);

  const data = page.getByRole("region", { name: "Datos" });
  await expect(data.getByText(`El link no cambia: /producto/${product.slug}`)).toBeVisible();
  await data.getByLabel("Nombre").fill(`${product.title.split(" · ")[1]} EDP`);
  await data.getByLabel("Género").selectOption({ label: "Unisex" });
  await data.getByLabel("Descripción").fill("Ámbar y vainilla.");
  await data.getByLabel("Destacado").check();
  await data.getByRole("button", { name: "Guardar datos" }).click();
  await expect(data.getByRole("status")).toHaveText("Datos guardados.");

  // Recargada, la ficha muestra lo guardado y el mismo link.
  await page.reload();
  const reloaded = page.getByRole("region", { name: "Datos" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${product.title} EDP`);
  await expect(reloaded.getByLabel("Género")).toHaveValue("unisex");
  await expect(reloaded.getByLabel("Descripción")).toHaveValue("Ámbar y vainilla.");
  await expect(reloaded.getByLabel("Destacado")).toBeChecked();
  await expect(reloaded.getByText(`El link no cambia: /producto/${product.slug}`)).toBeVisible();

  // Un nombre vacío no se guarda y el foco va al campo.
  await reloaded.getByLabel("Nombre").fill("");
  await reloaded.getByRole("button", { name: "Guardar datos" }).click();
  await expect(reloaded.getByLabel("Nombre")).toBeFocused();
  await expect(reloaded.getByText("Escribí el nombre del perfume.")).toBeVisible();
});

test("un producto que no existe (o un id mal escrito) muestra su propio no encontrado", async ({ page }) => {
  await signInAdmin(page, await createTestUser({ admin: true }));
  await expect(page).toHaveURL("/admin/pedidos");

  for (const id of ["00000000-0000-0000-0000-000000000000", "no-es-un-id"]) {
    await page.goto(`/admin/productos/${id}`);
    await expect(page.getByRole("heading", { level: 1, name: "No encontramos el producto" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/admin/productos");
  }
});
