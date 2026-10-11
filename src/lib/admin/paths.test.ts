// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ADMIN_LOGIN_PATH, adminProductPath, adminProxyRedirect } from "./paths";

describe("adminProductPath", () => {
  it("es la ficha del producto dentro de /admin/productos", () => {
    expect(adminProductPath("abc")).toBe("/admin/productos/abc");
  });
});

describe("adminProxyRedirect", () => {
  it("sin sesión, cualquier página del admin manda al login", () => {
    expect(adminProxyRedirect("/admin/pedidos", false)).toBe(ADMIN_LOGIN_PATH);
    expect(adminProxyRedirect("/admin/pedidos/abc", false)).toBe(ADMIN_LOGIN_PATH);
    expect(adminProxyRedirect("/admin", false)).toBe(ADMIN_LOGIN_PATH);
  });

  it("el login nunca redirige (con o sin sesión: lo decide la página)", () => {
    expect(adminProxyRedirect(ADMIN_LOGIN_PATH, false)).toBeNull();
    expect(adminProxyRedirect(ADMIN_LOGIN_PATH, true)).toBeNull();
  });

  it("con sesión deja pasar (si es admin lo decide requireAdmin, no el proxy)", () => {
    expect(adminProxyRedirect("/admin/pedidos", true)).toBeNull();
  });

  it("no toca rutas que solo empiezan parecido", () => {
    expect(adminProxyRedirect("/administracion", false)).toBeNull();
  });
});
