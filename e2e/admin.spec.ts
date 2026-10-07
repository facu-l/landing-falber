import { expect, test } from "@playwright/test";
import { createDeliveryOrder, createTestUser, expectOnLogin, signInAdmin } from "./admin-helpers";

/*
 * Panel de pedidos contra la app real: proxy, Supabase Auth, requireAdmin y RLS.
 * Cada test crea su usuario (y su pedido) con contraseñas al azar (e2e/admin-helpers.ts).
 */

test("/admin sin sesión redirige al login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expectOnLogin(page);
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
});

test("un usuario que no es admin no ve pedidos", async ({ page }) => {
  const user = await createTestUser({ admin: false });

  await signInAdmin(page, user);

  // requireAdmin lo devuelve al login, que ve la sesión y explica que no tiene acceso.
  await expectOnLogin(page);
  await expect(page.getByRole("status")).toContainText(`La cuenta ${user.email} no tiene acceso al panel.`);

  await page.goto("/admin/pedidos");
  await expectOnLogin(page);
  await expect(page.getByRole("heading", { name: "Pedidos" })).toHaveCount(0);

  // Puede salir y queda el formulario.
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});

test("un admin con sesión que abre el login va directo a los pedidos", async ({ page }) => {
  const admin = await createTestUser({ admin: true });
  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");

  await page.goto("/admin/login");

  await expect(page).toHaveURL("/admin/pedidos");
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
});

test("un admin confirma un pedido y le carga el costo de envío", async ({ page }) => {
  const [admin, order] = await Promise.all([createTestUser({ admin: true }), createDeliveryOrder()]);

  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");

  // El JavaScript de la página no puede leer la sesión: un XSS en la tienda no llega al panel.
  const session = (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) expect(cookie.httpOnly, cookie.name).toBe(true);

  await page.getByRole("link", { name: order.orderNumber }).click();

  await expect(page).toHaveURL(`/admin/pedidos/${order.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(order.orderNumber);

  // Confirmar
  const status = page.getByLabel("Nuevo estado");
  await expect(status.locator("option")).toHaveText(["Confirmado", "Cancelado"]);
  await page.getByRole("button", { name: "Cambiar estado" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Estado actualizado" })).toHaveText(
    "Estado actualizado: Confirmado.",
  );
  // refresh(): el pedido vuelve con su estado nuevo y las opciones que siguen.
  await expect(status.locator("option")).toHaveText(["Pagado", "Cancelado"]);

  // Costo de envío
  await page.getByLabel("Costo de envío", { exact: true }).fill("4.500");
  await page.getByRole("button", { name: "Guardar costo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Costo de envío" })).toContainText(
    /Costo de envío guardado: \$\s4\.500\./,
  );
  // El detalle ya no dice "A coordinar" (exact: el hint del campo también lo menciona).
  await expect(page.getByText("A coordinar", { exact: true })).toHaveCount(0);
});
