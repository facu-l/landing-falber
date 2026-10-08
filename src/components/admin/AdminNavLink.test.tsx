import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/admin/pedidos" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));

const { AdminNavLink } = await import("./AdminNavLink");

afterEach(() => {
  mocks.pathname = "/admin/pedidos";
});

function nav() {
  render(
    <>
      <AdminNavLink href="/admin/pedidos">Pedidos</AdminNavLink>
      <AdminNavLink href="/admin/envios">Envíos</AdminNavLink>
    </>,
  );
  return {
    orders: screen.getByRole("link", { name: "Pedidos" }),
    shipping: screen.getByRole("link", { name: "Envíos" }),
  };
}

describe("AdminNavLink", () => {
  it("marca la sección actual con aria-current (lo anuncia el lector de pantalla)", () => {
    mocks.pathname = "/admin/envios";
    const { orders, shipping } = nav();
    expect(shipping.getAttribute("aria-current")).toBe("page");
    expect(orders.hasAttribute("aria-current")).toBe(false);
  });

  it("en una subpágina (el detalle de un pedido) marca su sección", () => {
    mocks.pathname = "/admin/pedidos/f060303b-8447-45e5-ab0c-c59cd1705419";
    const { orders, shipping } = nav();
    expect(orders.getAttribute("aria-current")).toBe("page");
    expect(shipping.hasAttribute("aria-current")).toBe(false);
  });

  it("no confunde una ruta que solo empieza igual", () => {
    mocks.pathname = "/admin/pedidos-viejos";
    expect(nav().orders.hasAttribute("aria-current")).toBe(false);
  });
});
