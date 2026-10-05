import { expect, test } from "@playwright/test";

// Flujos de la Fase 2 sobre el catálogo de supabase/seed.sql (local y CI usan el mismo seed).

test("home → destacado → detalle del producto", async ({ page }) => {
  await page.goto("/");

  const featured = page.locator("section", { has: page.getByRole("heading", { name: "Destacados" }) });
  await expect(featured.getByRole("link")).toHaveCount(3);

  await featured.getByRole("link", { name: /Aventus/ }).click();
  await expect(page).toHaveURL(/\/producto\/creed-aventus$/);
  // Acotado al <article>: Next 16 conserva la home oculta en el DOM (para volver atrás
  // al instante), así que un getByText suelto también encontraría sus precios.
  const product = page.getByRole("article");
  await expect(product.getByRole("heading", { level: 1, name: "Aventus" })).toBeVisible();
  await expect(product.getByText("Decant 5 ml")).toBeVisible();
  await expect(product.getByText("$ 32.000", { exact: true })).toBeVisible();
});

test("el catálogo filtra por URL y nunca muestra productos inactivos", async ({ page }) => {
  await page.goto("/catalogo");
  await expect(page.getByText("8 perfumes")).toBeVisible();
  await expect(page.getByText("Producto oculto")).toHaveCount(0);

  await page.getByLabel("Género").selectOption("unisex");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/genero=unisex/);
  await expect(page.getByText("3 perfumes")).toBeVisible();
});

test("la búsqueda ignora tildes y muestra un estado vacío útil", async ({ page }) => {
  await page.goto("/catalogo?q=b%C3%A1ccarat");
  await expect(page.getByRole("link", { name: /Baccarat Rouge 540/ })).toBeVisible();
  await expect(page.getByText("1 perfume", { exact: true })).toBeVisible();

  await page.goto("/catalogo?q=inexistente");
  await expect(page.getByText("No encontramos perfumes con esos filtros.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver todo" })).toHaveAttribute("href", "/catalogo");
});

test("un producto agotado ofrece solicitar disponibilidad", async ({ page }) => {
  await page.goto("/producto/azzaro-the-most-wanted");
  await expect(page.getByText("Sin stock")).toBeVisible();
  await expect(page.getByRole("link", { name: "Solicitar disponibilidad" })).toHaveAttribute(
    "href",
    "/encargos?producto=azzaro-the-most-wanted",
  );
});

test("un producto inexistente o inactivo muestra la página de no encontrado", async ({ page }) => {
  for (const slug of ["no-existe", "producto-oculto"]) {
    await page.goto(`/producto/${slug}`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  }
});
