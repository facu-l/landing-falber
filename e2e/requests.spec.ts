import { expect, type Page, test } from "@playwright/test";
import { randomWhatsApp, useRandomIp, waitForTurnstile } from "./helpers";

/*
 * Encargos contra la app real: Supabase local (seed), Turnstile con las claves de
 * prueba de Cloudflare y create_perfume_request de verdad.
 *
 * Escriben en la base: cada test usa su propia IP (el límite de encargos es de 5 por
 * hora por IP) y su propio WhatsApp (decisión 43). The Most Wanted de Azzaro está
 * agotado en el seed (su única presentación, Frasco 100 ml, no tiene stock).
 */

const AZZARO = "/producto/azzaro-the-most-wanted";

test.beforeEach(async ({ page }) => {
  await useRandomIp(page);
});

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

async function fillCustomer(page: Page) {
  await field(page, "Nombre y apellido").fill("Prueba E2E");
  await field(page, "WhatsApp").fill(randomWhatsApp());
}

async function send(page: Page) {
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Enviar encargo" }).click();
}

test("encargo desde un producto agotado: llega con el perfume precargado", async ({ page }) => {
  await page.goto(AZZARO);
  await page.getByRole("link", { name: "Solicitar disponibilidad" }).click();

  await expect(page).toHaveURL("/encargos?producto=azzaro-the-most-wanted");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/¿No encontrás tu perfume\?/i);
  await expect(field(page, "Perfume")).toHaveValue("The Most Wanted");
  await expect(field(page, "Perfume")).not.toBeEditable();
  await expect(field(page, "Marca")).toHaveValue("Azzaro");
  await expect(field(page, "Presentación").locator("option:checked")).toHaveText("Frasco 100 ml");

  await fillCustomer(page);
  await send(page);

  const confirmation = page.getByRole("status").filter({ hasText: "Encargo recibido" });
  await expect(confirmation).toContainText("The Most Wanted");
  await expect(confirmation).toContainText("Te escribimos por WhatsApp");
});

test("encargo libre, sin producto", async ({ page }) => {
  await page.goto("/encargos");
  await expect(field(page, "Perfume")).toHaveValue("");

  await field(page, "Perfume").fill("Oud Wood Intense");
  await field(page, "Marca").fill("Tom Ford");
  await field(page, "Presentación").fill("Decant 10 ml");
  await fillCustomer(page);
  await send(page);

  await expect(page.getByRole("status").filter({ hasText: "Encargo recibido" })).toContainText("Oud Wood Intense");
});

test("un error del servidor conserva lo escrito", async ({ page }) => {
  await page.goto("/encargos?producto=azzaro-the-most-wanted");
  // Una variante que no existe pasa zod (es un UUID) y la base responde VARIANT_NOT_FOUND.
  await page
    .locator('select[name="variantId"] option:checked')
    .evaluate((option: HTMLOptionElement) => (option.value = "00000000-0000-4000-8000-000000000000"));
  await fillCustomer(page);
  const whatsapp = await field(page, "WhatsApp").inputValue();
  await field(page, "Aclaración").fill("Si llega antes de fin de mes");
  await send(page);

  // Filtro por texto: Next agrega su propio role="alert" (el anunciador de rutas).
  await expect(page.getByRole("alert").filter({ hasText: "ya no está en el catálogo" })).toBeVisible();
  await expect(field(page, "Nombre y apellido")).toHaveValue("Prueba E2E");
  await expect(field(page, "WhatsApp")).toHaveValue(whatsapp);
  await expect(field(page, "Aclaración")).toHaveValue("Si llega antes de fin de mes");
  await expect(page.getByRole("button", { name: "Enviar encargo" })).toBeEnabled();
});

test("un producto inexistente o inactivo muestra el formulario vacío", async ({ page }) => {
  for (const slug of ["no-existe", "producto-oculto"]) {
    await page.goto(`/encargos?producto=${slug}`);
    await expect(field(page, "Perfume")).toHaveValue("");
    await expect(field(page, "Perfume")).toBeEditable();
  }
});
