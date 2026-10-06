import { expect, type Page } from "@playwright/test";

/*
 * Helpers de los E2E que escriben en la base (pedidos y encargos, decisión 43).
 * Cada test usa su propia IP y su propio WhatsApp: los límites de la base son de
 * 5 por hora por IP y, en pedidos, de 3 pendientes por cliente.
 */

export const randomDigits = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

/** IP inventada en x-forwarded-for (en local y CI es la que usa clientIp, decisión 37). */
export async function useRandomIp(page: Page) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${randomDigits(2)}.${randomDigits(2)}.${randomDigits(2)}`,
  });
}

/** Formato real de La Plata con 0 y 15: la normalización la hace el servidor. */
export const randomWhatsApp = () => `0221 15 5${randomDigits(2)}-${randomDigits(4)}`;

// Turnstile (invisible, clave de prueba) tarda unos segundos en entregar el token.
export async function waitForTurnstile(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", { timeout: 15_000 });
}
