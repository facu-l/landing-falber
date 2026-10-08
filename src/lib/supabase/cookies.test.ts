// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "./cookies";

describe("sessionCookieOptions", () => {
  it.each(["production", "development", "test"] as const)("en %s, el JavaScript de la página no lee la sesión", (env) => {
    expect(sessionCookieOptions(env).httpOnly).toBe(true);
  });

  it("en producción la cookie viaja solo por HTTPS", () => {
    expect(sessionCookieOptions("production").secure).toBe(true);
  });

  it("en desarrollo no exige HTTPS: el celular entra por la IP de la red local, sin certificado", () => {
    expect(sessionCookieOptions("development").secure).toBe(false);
  });

  it("mantiene sameSite lax y la ruta raíz de los defaults de @supabase/ssr", () => {
    expect(sessionCookieOptions("production")).toMatchObject({ sameSite: "lax", path: "/" });
  });
});
