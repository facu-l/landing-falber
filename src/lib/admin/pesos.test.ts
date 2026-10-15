// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseWholePesos } from "./pesos";

describe("parseWholePesos", () => {
  it("acepta pesos enteros como los escribe la gente", () => {
    const cases: [string, number][] = [
      ["4500", 4500],
      ["4.500", 4500],
      ["$ 12.000", 12000],
      [" $4500 ", 4500],
      ["0", 0],
    ];
    for (const [raw, value] of cases) {
      expect(parseWholePesos(raw, 1_000_000)).toEqual({ success: true, value });
    }
  });

  it("vacío devuelve null: cada formulario decide si es válido", () => {
    expect(parseWholePesos("", 100)).toEqual({ success: true, value: null });
    expect(parseWholePesos("   ", 100)).toEqual({ success: true, value: null });
  });

  it("rechaza centavos, negativos y texto", () => {
    for (const raw of ["4500,50", "4.5", "-100", "cuatro mil", "45.00", "1.2345"]) {
      expect(parseWholePesos(raw, 1_000_000)).toEqual({ success: false, reason: "format" });
    }
  });

  it("el tope viene de quien llama y es inclusivo", () => {
    expect(parseWholePesos("100", 100)).toEqual({ success: true, value: 100 });
    expect(parseWholePesos("101", 100)).toEqual({ success: false, reason: "tooHigh" });
    expect(parseWholePesos("10.000.001", 10_000_000)).toEqual({ success: false, reason: "tooHigh" });
  });
});
