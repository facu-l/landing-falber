// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERIC_ORDER_ERROR, ORDER_ERRORS, orderError } from "./order-errors";

// Códigos que levanta una función de la migración: `raise exception using message = 'CODIGO'`.
function codesRaisedBy(functionName: string): string[] {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0001_initial_schema.sql"), "utf8");
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  const body = sql.slice(start, sql.indexOf("$$;", start));
  return [...body.matchAll(/message = '([A-Z_]+)'/g)].map((m) => m[1]);
}

describe("ORDER_ERRORS", () => {
  // create_order llama a enforce_rate_limit: sus errores también llegan al checkout.
  const raised = [...codesRaisedBy("create_order"), ...codesRaisedBy("enforce_rate_limit")];

  it("lee los códigos de la migración (si no, el test de abajo no prueba nada)", () => {
    expect(raised).toContain("INSUFFICIENT_STOCK");
    expect(raised).toContain("RATE_LIMITED");
  });

  it.each([...new Set(raised)])("tiene un mensaje para %s", (code) => {
    expect(ORDER_ERRORS[code as keyof typeof ORDER_ERRORS]).toBeTruthy();
  });

  it("los mensajes respetan la voz de la marca: sin signos de exclamación ni emojis", () => {
    for (const message of [...Object.values(ORDER_ERRORS), GENERIC_ORDER_ERROR]) {
      expect(message).not.toMatch(/[!¡]|\p{Extended_Pictographic}/u);
      expect(message).toMatch(/\.$/);
    }
  });
});

describe("orderError", () => {
  it("traduce el código que manda la base", () => {
    expect(orderError({ message: "CASH_REQUIRES_PICKUP", code: "P0001" })).toEqual({
      code: "CASH_REQUIRES_PICKUP",
      message: ORDER_ERRORS.CASH_REQUIRES_PICKUP,
      variantId: null,
      known: true,
    });
  });

  it("en los errores de stock devuelve la variante (viene en detail)", () => {
    const variantId = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
    expect(orderError({ message: "INSUFFICIENT_STOCK", details: variantId })).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      variantId,
    });
  });

  it.each([
    ["un código que no conocemos", { message: "SOMETHING_NEW" }],
    ["una violación de constraint (23514)", { message: 'new row violates check constraint "x"', code: "23514" }],
    ["un error de red", { message: "TypeError: fetch failed" }],
    ["un error sin mensaje", {}],
  ])("con %s devuelve el mensaje genérico y lo marca como desconocido", (_, error) => {
    expect(orderError(error)).toEqual({ code: "UNKNOWN", message: GENERIC_ORDER_ERROR, variantId: null, known: false });
  });
});
