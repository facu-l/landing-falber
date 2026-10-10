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

  // El nombre accesible incluye la red: un lector de pantalla no ve el logo.
  it.each([
    ["Instagram @falber.parfum", "https://www.instagram.com/falber.parfum/"],
    ["TikTok @falber.perfume", "https://www.tiktok.com/@falber.perfume"],
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
