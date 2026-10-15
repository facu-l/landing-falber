import { expect, test } from "@playwright/test";
import path from "node:path";
import { localAdminClient } from "../scripts/local-users";
import { createTestUser, createUnpublishedProduct, signInAdmin } from "./admin-helpers";

/*
 * Un producto armado desde el panel de punta a punta (Fase 7, PR 3): foto, presentación
 * con stock, movimiento de stock, publicar (aparece en la tienda) y ocultar (se va).
 *
 * Publica: corre en el proyecto catalog-writes (playwright.config.ts), después del resto,
 * porque catalog.spec.ts cuenta los perfumes del seed. Queda oculto al terminar.
 */
const PHOTO = path.join(__dirname, "fixtures", "photo-exif-orientation-6.jpg");

let productId: string | null = null;

// Si el test se corta con el producto publicado, el catálogo del seed queda con uno de más
// para las corridas siguientes: se oculta directo en la base, pase lo que pase.
test.afterEach(async () => {
  if (!productId) return;
  const { error } = await localAdminClient().from("products").update({ status: "inactive" }).eq("id", productId);
  if (error) throw error;
});

test("un admin arma un producto, lo publica y aparece en la tienda; ocultarlo lo saca", async ({ page }) => {
  const [admin, product] = await Promise.all([createTestUser({ admin: true }), createUnpublishedProduct()]);
  productId = product.id;
  const name = product.title.split(" · ")[1];
  const storeLink = page.getByRole("link", { name: new RegExp(name) });

  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");
  await page.goto(`/admin/productos/${product.id}`);
  // Acotado al encabezado: Next deja montadas y ocultas las páginas visitadas (Activity).
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });

  // Publicar sin foto: la base lo frena y el panel dice qué falta.
  await header.getByRole("button", { name: "Publicar" }).click();
  await expect(header.getByRole("alert")).toHaveText("Para publicar falta la foto.");

  const photo = page.getByRole("region", { name: "Foto" });
  await photo.getByLabel("Elegir foto").setInputFiles(PHOTO);
  await expect(photo.getByRole("status")).toHaveText("Foto guardada.", { timeout: 15_000 });
  // Cambió lo que falta: el rechazo anterior ya no es cierto y se deja de mostrar.
  await expect(header.getByText("Para publicar falta: una presentación disponible")).toBeVisible();
  await expect(header.getByRole("alert")).toHaveCount(0);

  // Una presentación con stock inicial: el ledger la deja en 3 u.
  const variants = page.getByRole("region", { name: "Presentaciones y stock" });
  await expect(variants.getByText("Sin presentaciones. Agregá la primera abajo.")).toBeVisible();
  await variants.getByLabel("Precio").fill("12.000");
  await variants.getByLabel("Stock inicial").fill("3");
  await variants.getByRole("button", { name: "Agregar presentación" }).click();
  await expect(variants.getByRole("status")).toHaveText("Se agregó Decant 3 ml.");
  const row = variants.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Decant 3 ml" }) });
  await expect(row.getByText("3 u.", { exact: true })).toBeVisible();

  // Mover stock: la cuenta en vivo y el movimiento en el historial.
  await row.getByRole("button", { name: "Mover stock Decant 3 ml" }).click();
  await row.getByLabel("Qué pasó").selectOption({ label: "Dañado o derramado" });
  await row.getByLabel("Cantidad").fill("1");
  await expect(row.getByText("Queda en 2 u.")).toBeVisible();
  await row.getByLabel("Nota").fill("Se cayó en el armado");
  await row.getByRole("button", { name: "Mover stock", exact: true }).click();
  await expect(row.getByRole("status")).toHaveText("Stock actualizado.");
  await expect(row.getByText("2 u.", { exact: true })).toBeVisible();
  await row.getByText("Historial (últimos 5)").click();
  const history = row.locator("details li");
  await expect(history.nth(0)).toContainText("Dañado o derramado");
  await expect(history.nth(0)).toContainText("−1");
  await expect(history.nth(0)).toContainText("Se cayó en el armado");
  await expect(history.nth(1)).toContainText("Stock inicial");
  await expect(history.nth(1)).toContainText("+3");

  // El caché, caliente justo antes de publicar: la foto y la presentación ya lo vencieron,
  // y sin esto la tienda lo mostraría aunque publicar no invalidara nada.
  await page.goto("/catalogo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(storeLink).toHaveCount(0);
  await page.goto(`/admin/productos/${product.id}`);

  // Publicar: ahora sí, y la tienda lo muestra sin esperar a que venza el caché.
  await header.getByRole("button", { name: "Publicar" }).click();
  await expect(header.getByRole("status")).toHaveText("Publicado.");
  await expect(header.getByText("Publicado", { exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: /Ver en la tienda/ })).toHaveAttribute("href", `/producto/${product.slug}`);

  await page.goto(`/producto/${product.slug}`);
  const article = page.getByRole("article");
  await expect(article.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(article.locator("img").first()).toBeVisible();
  await expect(article.getByText("Decant 3 ml")).toBeVisible();
  await expect(article.getByText("$ 12.000", { exact: true })).toBeVisible();
  await page.goto("/catalogo");
  await expect(storeLink).toBeVisible();

  // Ocultar pide confirmar, y después lo saca de la tienda (ficha y catálogo).
  await page.goto(`/admin/productos/${product.id}`);
  await header.getByRole("button", { name: "Ocultar" }).click();
  await expect(header.getByText(/Ocultar saca el perfume de la tienda ahora/)).toBeVisible();
  await header.getByRole("button", { name: "Sí, ocultar" }).click();
  await expect(header.getByRole("status")).toHaveText("Oculto. Ya no aparece en la tienda.");
  await expect(header.getByText("No publicado")).toBeVisible();

  await page.goto(`/producto/${product.slug}`);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await page.goto("/catalogo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(storeLink).toHaveCount(0);
});
