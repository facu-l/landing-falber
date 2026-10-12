import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ensureLocalUser, localAdminClient, randomPassword } from "../scripts/local-users";
import { randomDigits, waitForTurnstile } from "./helpers";

/*
 * Helpers de los E2E del admin. Usuarios y pedidos nuevos por test, contra Supabase
 * local (localAdminClient se niega a correr contra la nube). Sin credenciales fijas:
 * las contraseñas se generan en cada corrida.
 */

export type TestUser = { email: string; password: string };

export async function createTestUser({ admin }: { admin: boolean }): Promise<TestUser> {
  const user = { email: `e2e-${admin ? "admin" : "user"}-${randomUUID()}@falber.test`, password: randomPassword() };
  await ensureLocalUser({ ...user, admin });
  return user;
}

/**
 * Pedido de envío nuevo, creado con create_order (la misma RPC del checkout) sin pasar
 * por la tienda: el flujo de compra ya lo cubre checkout.spec.ts.
 */
export async function createDeliveryOrder(): Promise<{ id: string; orderNumber: string }> {
  const supabase = localAdminClient();

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id")
    .gt("stock", 5)
    .limit(1)
    .single();
  if (variantError) throw variantError;

  const { data, error } = await supabase.rpc("create_order", {
    p_request_id: randomUUID(),
    p_client_key: `e2e-${randomUUID()}`,
    p_full_name: "Prueba Admin",
    p_whatsapp: `+549221${randomDigits(7)}`,
    p_email: "",
    p_payment_method: "transfer",
    p_delivery_method: "delivery",
    p_delivery_address: "Calle 7 1234",
    p_delivery_city: "La Plata",
    p_delivery_postal_code: "",
    p_delivery_reference: "",
    p_order_note: "",
    p_items: [{ variant_id: variant.id, quantity: 1 }],
  });
  if (error) throw error;

  const order = data as { order_id: string; order_number: string };
  return { id: order.order_id, orderNumber: order.order_number };
}

/**
 * Producto nuevo sin publicar, directo en la base: el alta por la UI ya la cubre
 * admin-products.spec.ts. Queda en la base (no se borra, decisión 95); db:reset lo limpia.
 */
export async function createUnpublishedProduct(): Promise<{ id: string; slug: string; title: string }> {
  const name = `Foto ${randomDigits(6)}`;
  const slug = `falber-test-${name.toLowerCase().replace(" ", "-")}`;
  const { data, error } = await localAdminClient()
    .from("products")
    .insert({ brand: "FALBER Test", name, slug })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, slug, title: `FALBER Test · ${name}` };
}

/**
 * Encargo nuevo, creado con create_perfume_request (la misma RPC de /encargos) sin pasar
 * por la tienda: el formulario ya lo cubre requests.spec.ts.
 */
export async function createPerfumeRequest(perfumeName: string): Promise<void> {
  const { error } = await localAdminClient().rpc("create_perfume_request", {
    p_client_key: `e2e-${randomUUID()}`,
    p_full_name: "Prueba Admin",
    p_whatsapp: `+549221${randomDigits(7)}`,
    p_perfume_name: perfumeName,
    p_brand: "Creed",
    p_presentation: "Decant 10 ml",
    p_note: "",
  });
  if (error) throw error;
}

export async function signInAdmin(page: Page, user: TestUser) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  // Auth exige el CAPTCHA ([auth.captcha] en supabase/config.toml).
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

export async function expectOnLogin(page: Page) {
  await expect(page).toHaveURL("/admin/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/panel/i);
}
