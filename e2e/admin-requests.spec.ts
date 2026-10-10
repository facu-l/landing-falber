import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createPerfumeRequest, createTestUser, signInAdmin } from "./admin-helpers";

/*
 * Encargos en el panel (decisión 90): la base no avisa a nadie, así que el registro es
 * esta lista y el número de pendientes en la navegación. Cada test crea su admin y su
 * encargo; el número exacto no se compara porque otros tests crean encargos en paralelo.
 */

test("un encargo nuevo aparece en Encargos, se le escribe por WhatsApp y cambia de estado", async ({ page }) => {
  const perfume = `Encargo E2E ${randomUUID().slice(0, 8)}`;
  await createPerfumeRequest(perfume);
  const admin = await createTestUser({ admin: true });

  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");

  // El aviso: la pestaña lleva cuántos encargos esperan.
  const tab = page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: /^Encargos \d+ pendientes$/ });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page).toHaveURL("/admin/encargos");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Encargos");

  const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: perfume }) });
  await expect(row).toContainText("Creed · Decant 10 ml");
  await expect(row).toContainText("Pendiente");

  const reply = new URL((await row.getByRole("link", { name: "Escribirle por WhatsApp" }).getAttribute("href"))!);
  expect(reply.searchParams.get("text")).toBe(`Hola Prueba, te escribo de FALBER por tu encargo de ${perfume}.`);

  await row.getByLabel("Estado del encargo").selectOption("contacted");
  await row.getByRole("button", { name: "Cambiar" }).click();

  await expect(row.getByRole("status")).toHaveText("Estado actualizado: Contactado.");
  await expect(row).toContainText("Contactado");
});
