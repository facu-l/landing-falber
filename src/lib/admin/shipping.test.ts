// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Constants } from "@/types/database";
import { canSetShippingCost, parseShippingCost, SHIPPING_COST_ERRORS } from "./shipping";

describe("parseShippingCost", () => {
  it("acepta pesos enteros como los escribe la gente", () => {
    const cases: [string, number][] = [
      ["4500", 4500],
      ["4.500", 4500],
      ["$ 4.500", 4500],
      [" $4500 ", 4500],
      ["0", 0],
    ];
    for (const [raw, value] of cases) {
      expect(parseShippingCost(raw)).toEqual({ success: true, value });
    }
  });

  it("vacío = a coordinar (null)", () => {
    expect(parseShippingCost("")).toEqual({ success: true, value: null });
    expect(parseShippingCost("   ")).toEqual({ success: true, value: null });
  });

  it("rechaza centavos, negativos y texto", () => {
    for (const raw of ["4500,50", "4.5", "-100", "cuatro mil", "45.00"]) {
      expect(parseShippingCost(raw)).toEqual({ success: false, error: SHIPPING_COST_ERRORS.format });
    }
  });

  it("rechaza un monto que seguro es un error de tipeo", () => {
    expect(parseShippingCost("1.000.001")).toEqual({ success: false, error: SHIPPING_COST_ERRORS.tooHigh });
    expect(parseShippingCost("1.000.000")).toEqual({ success: true, value: 1_000_000 });
  });
});

describe("canSetShippingCost (copia de guard_shipping_cost)", () => {
  it("un retiro nunca lleva costo de envío", () => {
    for (const status of Constants.public.Enums.order_status) {
      expect(canSetShippingCost({ status, delivery_method: "pickup" })).toBe(false);
    }
  });

  it("un envío se puede cargar hasta que sale o se cierra", () => {
    const open = Constants.public.Enums.order_status.filter((status) =>
      canSetShippingCost({ status, delivery_method: "delivery" }),
    );
    expect(open).toEqual(["pending", "confirmed", "paid", "preparing", "ready_for_pickup"]);
  });
});
