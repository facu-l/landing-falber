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
});
