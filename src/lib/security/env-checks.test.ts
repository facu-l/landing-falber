// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertProductionEnv, isLocalSupabaseUrl, siteHostnames } from "./env-checks";

const REAL_SECRET = "0x4AAAAAAAreal-secret-from-cloudflare";

describe("siteHostnames", () => {
  it("separa por comas y saca espacios y vacíos", () => {
    expect(siteHostnames(" falber.com.ar, falber.netlify.app ,,")).toEqual(["falber.com.ar", "falber.netlify.app"]);
  });

  it("pasa a minúsculas (un hostname no distingue mayúsculas)", () => {
    expect(siteHostnames("Falber.com.ar")).toEqual(["falber.com.ar"]);
  });

  it("acepta localhost (desarrollo y CI)", () => {
    expect(siteHostnames("localhost")).toEqual(["localhost"]);
  });

  it.each([undefined, "", " , "])("con %j falla nombrando la variable", (value) => {
    expect(() => siteHostnames(value)).toThrow(/SITE_HOSTNAMES/);
  });

  // Un valor mal escrito nunca coincide con el hostname de Cloudflare: rechazaría
  // todos los pedidos en silencio. Tiene que fallar con un mensaje claro.
  it.each(["https://falber.com.ar", "falber.com.ar/", "falber.com.ar:443", "falber.com.ar."])(
    "rechaza %j como dominio mal escrito",
    (value) => {
      expect(() => siteHostnames(value)).toThrow(/SITE_HOSTNAMES.*no es un dominio/);
    },
  );
});

// next/image bloquea las IPs locales (SSRF) salvo que se habilite; solo se habilita con el
// Supabase local de desarrollo y CI. Nunca puede dar true con la URL de la nube.
describe("isLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321", "http://LOCALHOST:54321/"])(
    "%s es local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
    },
  );

  it.each([undefined, "", "https://abc.supabase.co", "https://127.0.0.1.nip.io", "no es una url"])(
    "%j no es local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(false);
    },
  );
});

describe("assertProductionEnv", () => {
  const production = { CONTEXT: "production", SITE_HOSTNAMES: "falber.com.ar,falber.netlify.app", TURNSTILE_SECRET_KEY: REAL_SECRET };

  it("con todo bien cargado no lanza", () => {
    expect(() => assertProductionEnv(production)).not.toThrow();
  });

  it("fuera del build de producción no mira nada (local, CI, previews)", () => {
    expect(() => assertProductionEnv({})).not.toThrow();
    expect(() => assertProductionEnv({ CONTEXT: "deploy-preview" })).not.toThrow();
  });

  it("en producción frena el build si falta SITE_HOSTNAMES", () => {
    expect(() => assertProductionEnv({ ...production, SITE_HOSTNAMES: undefined })).toThrow(/SITE_HOSTNAMES/);
  });

  // Con una URL local, next.config.ts habilita las IPs locales en next/image (D5).
  it("en producción frena el build si la URL de Supabase es local", () => {
    expect(() => assertProductionEnv({ ...production, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it.each(["1x0000000000000000000000000000000AA", "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"])(
    "en producción frena el build con el secreto de prueba %s",
    (secret) => {
      expect(() => assertProductionEnv({ ...production, TURNSTILE_SECRET_KEY: secret })).toThrow(/TURNSTILE_SECRET_KEY/);
    },
  );
});
