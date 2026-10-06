import { expect, type Page, test } from "@playwright/test";
import { randomWhatsApp, useRandomIp, waitForTurnstile } from "./helpers";

/*
 * Compra completa contra la app real: Supabase local (seed), Turnstile con las claves
 * de prueba de Cloudflare y create_order de verdad.
 *
 * Estos tests escriben en la base. Para poder repetirlos:
 * - cada test manda una IP inventada (x-forwarded-for): si no, todos comparten el
 *   límite de 5 pedidos por hora por IP;
 * - cada test usa un WhatsApp distinto: la base corta en 3 pedidos pendientes por cliente;
 * - compran el decant de 5 ml de Sauvage (24 unidades en el seed, 4 por corrida).
 *   Si se agota en local: `npm run db:reset`.
 */

const PRODUCT_PATH = "/producto/dior-sauvage-edt";
const FALBER_WHATSAPP = "5492355481449";

test.beforeEach(async ({ page }) => {
  await useRandomIp(page);
});

async function addSauvageToCart(page: Page) {
  await page.goto(PRODUCT_PATH);
  const product = page.getByRole("article");
  await expect(product.getByRole("radio", { name: /Decant 5 ml/ })).toBeChecked();
  await product.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(product.getByRole("status")).toContainText("Agregado al carrito");
}

async function fillCustomer(page: Page) {
  await page.getByLabel("Nombre y apellido", { exact: true }).fill("Prueba E2E");
  await page.getByLabel("WhatsApp", { exact: true }).fill(randomWhatsApp());
}

test("compra completa: producto → carrito → checkout → pedido con el link de WhatsApp", async ({ page }) => {
  await addSauvageToCart(page);
  await expect(page.getByRole("link", { name: "Carrito, 1 unidad" })).toBeVisible();

  await page.getByRole("link", { name: "Ver carrito" }).click();
  await expect(page).toHaveURL("/carrito");
  await expect(page.getByTestId("cart-total")).toHaveText(/\$\s?14\.500/);
  await page.getByRole("link", { name: "Finalizar compra" }).click();

  await expect(page).toHaveURL("/checkout");
  await fillCustomer(page);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Realizar compra" }).click();

  await page.waitForURL(/\/pedido\/[0-9a-f-]{36}$/);
  const order = page.getByRole("article");
  await expect(order.getByRole("heading", { level: 1, name: "Detalle de tu compra" })).toBeVisible();
  await expect(order.getByText("Estado del pedido: Pendiente")).toBeVisible();
  await expect(order.getByRole("listitem")).toHaveText([/1 × Sauvage EDT — Decant 5 ml\s*\$\s?14\.500/]);

  const orderNumber = (await order.getByText(/^FAL-\d+$/).textContent())!;
  const href = await order.getByRole("link", { name: "Completar pedido en WhatsApp" }).getAttribute("href");
  const url = new URL(href!);
  expect(url.origin + url.pathname).toBe(`https://wa.me/${FALBER_WHATSAPP}`);
  expect(url.searchParams.get("text")).toBe(
    [
      `Hola FALBER. Quiero confirmar mi pedido ${orderNumber}.`,
      "",
      "• 1x Sauvage EDT — Decant 5 ml ($14.500)",
      "",
      "Total estimado: $14.500",
      "Entrega: Retiro en La Plata",
      "Pago: Transferencia",
    ].join("\n"),
  );

  // El carrito quedó vacío.
  await expect(page.getByRole("link", { name: "Carrito", exact: true })).toBeVisible();
});

test("doble click en Realizar compra manda un solo pedido", async ({ page }) => {
  await addSauvageToCart(page);
  await page.goto("/checkout");
  await fillCustomer(page);
  await waitForTurnstile(page);

  // Las Server Actions son POST con el header Next-Action.
  let actionPosts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) actionPosts++;
  });

  await page.getByRole("button", { name: "Realizar compra" }).dblclick();
  await page.waitForURL(/\/pedido\/[0-9a-f-]{36}$/);
  expect(actionPosts).toBe(1);
});

test("envío sin dirección: el servidor marca los campos y no crea el pedido", async ({ page }) => {
  await addSauvageToCart(page);
  await page.goto("/checkout");
  await fillCustomer(page);
  await page.getByText("Envío a domicilio").click();
  await expect(page.getByRole("radio", { name: /Efectivo/ })).toBeDisabled();
  await page.getByRole("button", { name: "Realizar compra" }).click();

  await expect(page.getByText("Escribí la dirección de entrega.")).toBeVisible();
  await expect(page.getByLabel("Dirección", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL("/checkout");
  // Lo escrito se conserva.
  await expect(page.getByLabel("Nombre y apellido", { exact: true })).toHaveValue("Prueba E2E");
});

test("un producto que ya no existe en el carrito frena la compra", async ({ page }) => {
  await page.goto("/carrito");
  await page.evaluate(() =>
    localStorage.setItem(
      "falber:cart:v1",
      JSON.stringify([{ variantId: "00000000-0000-4000-8000-000000000000", quantity: 1 }]),
    ),
  );
  await page.reload();

  // Filtro por texto: Next agrega su propio role="alert" (el anunciador de rutas).
  await expect(page.getByRole("alert").filter({ hasText: "ya no está disponible" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Finalizar compra" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quitar los no disponibles" }).click();
  await expect(page.getByText("Tu carrito está vacío.")).toBeVisible();
});
