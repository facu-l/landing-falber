import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("asocia el label al select y conserva el valor por defecto", () => {
    render(
      <Select label="Género" name="genero" defaultValue="unisex">
        <option value="">Todos</option>
        <option value="unisex">Unisex</option>
      </Select>,
    );
    const select = screen.getByLabelText("Género") as HTMLSelectElement;
    expect(select.name).toBe("genero");
    expect(select.value).toBe("unisex");
  });

  it("sin error no marca el campo como inválido", () => {
    render(
      <Select label="Presentación">
        <option value="a">A</option>
      </Select>,
    );
    const select = screen.getByLabelText("Presentación");
    expect(select.getAttribute("aria-invalid")).toBeNull();
    expect(select.getAttribute("aria-describedby")).toBeNull();
  });

  it("con error lo muestra, marca el campo y conecta el mensaje (igual que Input)", () => {
    render(
      <Select label="Presentación" error="Elegí una de las presentaciones.">
        <option value="a">A</option>
      </Select>,
    );
    const select = screen.getByLabelText("Presentación");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(select.getAttribute("aria-describedby")!);
    expect(message?.textContent).toBe("Elegí una de las presentaciones.");
    expect(message?.className).toContain("text-error");
    expect(select.className).toContain("border-error");
  });
});
