// @vitest-environment node
import { describe, expect, it } from "vitest";
import { required, supabaseUrl } from "./env";

describe("required", () => {
  it("devuelve el valor cuando existe", () => {
    expect(required("X", "valor")).toBe("valor");
  });

  it.each([undefined, ""])("con %j falla nombrando la variable y cómo arreglarlo", (value) => {
    expect(() => required("SUPABASE_SERVICE_ROLE_KEY", value)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY.*\.env\.example/,
    );
  });
});

describe("supabaseUrl", () => {
  it.each(["https://abc.supabase.co", "https://abc.supabase.co/", "http://127.0.0.1:54321"])(
    "acepta la URL base %s",
    (value) => {
      expect(supabaseUrl(value)).toBe(value);
    },
  );

  // Con /rest/v1 el build falla con "Invalid path specified in request URL":
  // el cliente de Supabase ya agrega el path de cada servicio.
  it.each([
    "https://abc.supabase.co/rest/v1",
    "https://abc.supabase.co/rest/v1/",
    "https://abc.supabase.co/?x=1",
    "https://abc.supabase.co/#x",
  ])(
    "rechaza %s nombrando la variable y pidiendo la URL sin path",
    (value) => {
      expect(() => supabaseUrl(value)).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*sin path/);
    },
  );

  it("rechaza un valor que no es una URL", () => {
    expect(() => supabaseUrl("abc.supabase.co")).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("falla si falta", () => {
    expect(() => supabaseUrl(undefined)).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*\.env\.example/);
  });
});
