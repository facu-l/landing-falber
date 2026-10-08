import { expect, type Page, test } from "@playwright/test";
import { localAdminClient } from "../scripts/local-users";
import { createTestUser, signInAdmin } from "./admin-helpers";
import { randomDigits } from "./helpers";

/*
 * Envíos estimados de punta a punta: el admin los cambia en /admin/envios y el checkout
 * los muestra debajo de "Envío a domicilio".
 *
 * shipping_rates es una sola fila para toda la tienda: este test corre solo en el
 * proyecto desktop (en paralelo, el de mobile pisaría los montos) y al final deja los
 * valores del seed.
 */

const SEED = { estimate_to_branch: 7000, estimate_to_home: 9000 };

test.afterEach(async () => {
  const { error } = await localAdminClient().from("shipping_rates").update(SEED).eq("id", true);
  if (error) throw error;
});

/** es-AR: punto de miles y espacio duro después del "$" (formatARS). "9123" → "$ 9.123". */
const pesos = (amount: string) => new RegExp(`\\$\\s${amount.slice(0, 1)}\\.${amount.slice(1)}`);

async function openCheckoutWithDelivery(page: Page) {
  await page.goto("/checkout");
  await page.getByText("Envío a domicilio", { exact: true }).click();
}

test("el admin cambia los envíos estimados y el checkout los muestra", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una sola fila para toda la tienda: un proyecto a la vez");

  // Montos distintos en cada corrida: así no puede pasar por un valor viejo.
  const toBranch = `7${randomDigits(3)}`;
  const toHome = `9${randomDigits(3)}`;

  // Primero el checkout con los montos de siempre: deja el caché caliente. Sin esto el
  // test no distingue si guardar invalida el caché (la primera lectura ya sería nueva).
  await page.goto("/producto/dior-sauvage-edt");
  await page.getByRole("article").getByRole("button", { name: "Agregar al carrito" }).click();
  await openCheckoutWithDelivery(page);
  await expect(page.getByText(/Envío estimado a domicilio/)).toHaveText(pesos("9000"));

  const admin = await createTestUser({ admin: true });
  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");
  await page.getByRole("link", { name: "Envíos" }).click();
  await expect(page).toHaveURL("/admin/envios");

  await page.getByLabel("Envío estimado a sucursal", { exact: true }).fill(toBranch);
  await page.getByLabel("Envío estimado a domicilio", { exact: true }).fill(toHome);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toHaveText("Envíos estimados guardados.");

  await openCheckoutWithDelivery(page);
  await expect(page.getByText(/Envío estimado a sucursal/)).toHaveText(pesos(toBranch));
  await expect(page.getByText(/Envío estimado a domicilio/)).toHaveText(pesos(toHome));
});
