import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("muestra el copyright dentro del pie de página", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByText("© 2026 FALBER. Todos los derechos reservados."),
    ).toBeTruthy();
  });

  // Google Merchant Center exige que la política se encuentre desde el sitio.
  it("enlaza la política de cambios y devoluciones", () => {
    render(<SiteFooter />);
    const tienda = screen.getByRole("navigation", { name: "Tienda" });
    const link = within(tienda).getByRole("link", { name: "Cambios y devoluciones" });
    expect(link.getAttribute("href")).toBe("/cambios-y-devoluciones");
  });

  // El nombre accesible incluye la red: un lector de pantalla no ve el logo.
  it.each([
    ["Instagram @falber.parfum", "https://www.instagram.com/falber.parfum/"],
    ["TikTok @falber.parfum", "https://www.tiktok.com/@falber.parfum"],
    ["Facebook FALBER", "https://www.facebook.com/profile.php?id=61595043872733"],
  ])("enlaza %s en una pestaña nueva", (name, href) => {
    render(<SiteFooter />);
    const redes = screen.getByRole("navigation", { name: "Redes sociales" });
    const link = within(redes).getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
