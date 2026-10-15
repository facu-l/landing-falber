import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioGroup, RadioOption } from "./Radio";

function Group({ onChange = () => {}, error, disabled }: { onChange?: () => void; error?: string; disabled?: boolean }) {
  return (
    <RadioGroup legend="Tipo de presentación" error={error}>
      <RadioOption name="variantType" value="decant" checked onChange={() => {}} label="Decant" detail="3, 5 o 10 ml." />
      <RadioOption
        name="variantType"
        value="full_bottle"
        checked={false}
        onChange={onChange}
        disabled={disabled}
        label="Frasco"
        detail="Los ml a mano."
      />
    </RadioGroup>
  );
}

describe("RadioGroup y RadioOption", () => {
  it("son radios nativos dentro de un grupo con nombre", () => {
    render(<Group />);
    expect(screen.getByRole("group", { name: "Tipo de presentación" })).toBeTruthy();
    const decant = screen.getByRole("radio", { name: /Decant/ }) as HTMLInputElement;
    expect(decant.checked).toBe(true);
    expect(decant.name).toBe("variantType");
  });

  it("se elige tocando la fila entera", () => {
    const onChange = vi.fn();
    render(<Group onChange={onChange} />);
    fireEvent.click(screen.getByText("Los ml a mano."));
    expect(onChange).toHaveBeenCalled();
  });

  it("una opción deshabilitada no se puede elegir", () => {
    render(<Group disabled />);
    expect((screen.getByRole("radio", { name: /Frasco/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it("muestra el error y marca el grupo como inválido", () => {
    render(<Group error="Elegí Decant o Frasco." />);
    expect(screen.getByText("Elegí Decant o Frasco.")).toBeTruthy();
    expect(screen.getByRole("group").getAttribute("aria-invalid")).toBe("true");
  });
});
