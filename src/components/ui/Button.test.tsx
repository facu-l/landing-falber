import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonClasses } from "./Button";

describe("Button", () => {
  it('es type="button" por defecto para no enviar formularios sin querer', () => {
    render(<Button>Agregar</Button>);
    expect(screen.getByRole("button", { name: "Agregar" }).getAttribute("type")).toBe("button");
  });

  it('respeta type="submit" cuando se pide', () => {
    render(<Button type="submit">Realizar compra</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("usa el fondo accent en primario y borde border-strong en secundario", () => {
    expect(buttonClasses("primary")).toContain("bg-accent");
    expect(buttonClasses("secondary")).toContain("border-border-strong");
  });

  it("pasa disabled al elemento (doble click en el checkout)", () => {
    render(<Button disabled>Enviando</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
