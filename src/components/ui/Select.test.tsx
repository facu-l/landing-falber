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
});
