// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseLogin } from "./login";

describe("parseLogin", () => {
  it("normaliza el email (espacios y mayúsculas) y deja la contraseña tal cual", () => {
    expect(parseLogin({ email: "  Admin@Falber.Test ", password: " clave con espacios " })).toEqual({
      success: true,
      data: { email: "admin@falber.test", password: " clave con espacios " },
    });
  });

  it("pide un email válido", () => {
    expect(parseLogin({ email: "admin", password: "x" })).toEqual({
      success: false,
      fieldErrors: { email: "Escribí un email válido." },
    });
  });

  it("pide la contraseña", () => {
    expect(parseLogin({ email: "admin@falber.test", password: "" })).toEqual({
      success: false,
      fieldErrors: { password: "Escribí tu contraseña." },
    });
  });

  it("un campo que no llega cuenta como vacío", () => {
    expect(parseLogin({})).toEqual({
      success: false,
      fieldErrors: { email: "Escribí un email válido.", password: "Escribí tu contraseña." },
    });
  });
});
