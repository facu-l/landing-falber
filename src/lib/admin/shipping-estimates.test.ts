// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SHIPPING_COST_ERRORS } from "./shipping";
import { parseShippingEstimates, SHIPPING_ESTIMATE_REQUIRED } from "./shipping-estimates";

describe("parseShippingEstimates", () => {
  it("acepta los montos como se escriben (4500, 4.500, $ 4.500)", () => {
    expect(parseShippingEstimates({ toBranch: "7000", toHome: "$ 9.500" })).toEqual({
      success: true,
      data: { toBranch: 7000, toHome: 9500 },
    });
  });

  // A diferencia del costo de un pedido, un estimado vacío no es "a coordinar":
  // el checkout mostraría "$ 0".
  it("vacío no vale: los dos campos son obligatorios", () => {
    expect(parseShippingEstimates({ toBranch: " ", toHome: "" })).toEqual({
      success: false,
      fieldErrors: { toBranch: SHIPPING_ESTIMATE_REQUIRED, toHome: SHIPPING_ESTIMATE_REQUIRED },
    });
  });

  it("un monto mal escrito o demasiado alto marca solo ese campo", () => {
    expect(parseShippingEstimates({ toBranch: "7000,50", toHome: "1.000.001" })).toEqual({
      success: false,
      fieldErrors: { toBranch: SHIPPING_COST_ERRORS.format, toHome: SHIPPING_COST_ERRORS.tooHigh },
    });
    expect(parseShippingEstimates({ toBranch: "7000", toHome: "abc" })).toEqual({
      success: false,
      fieldErrors: { toHome: SHIPPING_COST_ERRORS.format },
    });
  });

  it("si falta un campo en el formulario, cuenta como vacío", () => {
    expect(parseShippingEstimates({ toBranch: "7000" })).toEqual({
      success: false,
      fieldErrors: { toHome: SHIPPING_ESTIMATE_REQUIRED },
    });
  });
});
