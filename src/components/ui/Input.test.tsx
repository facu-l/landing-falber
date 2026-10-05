import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("asocia el label al campo", () => {
    render(<Input label="WhatsApp" name="whatsapp" />);
    expect(screen.getByLabelText("WhatsApp").getAttribute("name")).toBe("whatsapp");
  });

  it("conecta el hint con aria-describedby", () => {
    render(<Input label="WhatsApp" hint="Con código de área" />);
    const input = screen.getByLabelText("WhatsApp");
    const hint = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(hint?.textContent).toBe("Con código de área");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("con error marca el campo inválido y muestra el error en lugar del hint", () => {
    render(<Input label="WhatsApp" hint="Con código de área" error="Número inválido" />);
    const input = screen.getByLabelText("WhatsApp");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Número inválido",
    );
    expect(screen.queryByText("Con código de área")).toBeNull();
  });

  it('un error vacío ("") no esconde el hint ni marca el campo inválido', () => {
    render(<Input label="WhatsApp" hint="Con código de área" error="" />);
    expect(screen.getByText("Con código de área")).toBeTruthy();
    expect(screen.getByLabelText("WhatsApp").getAttribute("aria-invalid")).toBeNull();
  });
});
