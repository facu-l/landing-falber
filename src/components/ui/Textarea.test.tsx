import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("asocia el label al campo y usa 4 filas por defecto", () => {
    render(<Textarea label="Descripción" name="description" />);
    const textarea = screen.getByLabelText("Descripción");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("name")).toBe("description");
    expect(textarea.getAttribute("rows")).toBe("4");
  });

  it("conecta el hint con aria-describedby", () => {
    render(<Textarea label="Descripción" hint="Se muestra en la ficha" />);
    const textarea = screen.getByLabelText("Descripción");
    expect(document.getElementById(textarea.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Se muestra en la ficha",
    );
    expect(textarea.getAttribute("aria-invalid")).toBeNull();
  });

  it("con error marca el campo inválido y muestra el error en lugar del hint", () => {
    render(<Textarea label="Descripción" hint="Se muestra en la ficha" error="Demasiado larga" />);
    const textarea = screen.getByLabelText("Descripción");
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(textarea.className).toContain("border-error");
    expect(textarea.className).not.toContain("focus:border-accent");
    expect(screen.getByText("Demasiado larga").className).toContain("text-error");
    expect(screen.queryByText("Se muestra en la ficha")).toBeNull();
  });

  it('un error vacío ("") no esconde el hint ni marca el campo inválido', () => {
    render(<Textarea label="Descripción" hint="Se muestra en la ficha" error="" />);
    expect(screen.getByText("Se muestra en la ficha")).toBeTruthy();
    expect(screen.getByLabelText("Descripción").getAttribute("aria-invalid")).toBeNull();
  });
});
