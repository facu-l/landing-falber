import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("es un checkbox nativo asociado a su label", () => {
    render(<Checkbox label="Destacado" name="featured" />);
    const checkbox = screen.getByRole("checkbox", { name: "Destacado" });
    expect(checkbox.getAttribute("name")).toBe("featured");
  });

  it("se tilda tocando el label (todo el renglón es el área táctil)", () => {
    render(<Checkbox label="Destacado" />);
    const checkbox = screen.getByRole("checkbox", { name: "Destacado" }) as HTMLInputElement;
    fireEvent.click(screen.getByText("Destacado"));
    expect(checkbox.checked).toBe(true);
    expect(checkbox.closest("label")?.className).toContain("min-h-11");
  });

  it("conserva el valor por defecto", () => {
    render(<Checkbox label="Destacado" defaultChecked />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("conecta el hint con aria-describedby", () => {
    render(<Checkbox label="Destacado" hint="La home muestra hasta 3 destacados con stock." />);
    const checkbox = screen.getByRole("checkbox");
    expect(document.getElementById(checkbox.getAttribute("aria-describedby")!)?.textContent).toBe(
      "La home muestra hasta 3 destacados con stock.",
    );
    expect(checkbox.getAttribute("aria-invalid")).toBeNull();
  });

  it("con error marca el campo inválido y muestra el error en lugar del hint", () => {
    render(<Checkbox label="Destacado" hint="Un hint" error="No se pudo guardar" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(checkbox.getAttribute("aria-describedby")!);
    expect(message?.textContent).toBe("No se pudo guardar");
    expect(message?.className).toContain("text-error");
    expect(screen.queryByText("Un hint")).toBeNull();
  });

  it('un error vacío ("") no esconde el hint ni marca el campo inválido', () => {
    render(<Checkbox label="Destacado" hint="Un hint" error="" />);
    expect(screen.getByText("Un hint")).toBeTruthy();
    expect(screen.getByRole("checkbox").getAttribute("aria-invalid")).toBeNull();
  });
});
