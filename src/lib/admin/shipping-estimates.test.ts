// @vitest-environment node
import { describe, expect, it } from "vitest";
import { migrationSql } from "@/test/migration";
import { SHIPPING_COST_ERRORS, SHIPPING_COST_MAX } from "./shipping";
import { getShippingEstimatesForAdmin, parseShippingEstimates, SHIPPING_ESTIMATE_REQUIRED } from "./shipping-estimates";

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

// El parser y el check de la base repiten el tope: si cambia uno solo, el admin guarda
// un monto que la base rechaza con un error genérico (o al revés).
describe("el tope de los estimados coincide con la migración", () => {
  it.each(["estimate_to_branch", "estimate_to_home"])("%s usa SHIPPING_COST_MAX", (column) => {
    // \s+: las columnas están alineadas con espacios en la migración.
    expect(migrationSql()).toMatch(
      new RegExp(`${column}\\s+integer not null check \\(${column} between 0 and ${SHIPPING_COST_MAX}\\)`),
    );
  });
});

describe("getShippingEstimatesForAdmin", () => {
  /** El cliente de la sesión, solo con lo que usa la lectura: from().select().single(). */
  const client = (result: { data: unknown; error: unknown }) =>
    ({ from: () => ({ select: () => ({ single: async () => result }) }) }) as unknown as Parameters<
      typeof getShippingEstimatesForAdmin
    >[0];

  it("devuelve los montos guardados", async () => {
    const row = { estimate_to_branch: 7000, estimate_to_home: 9000, id: true, updated_at: "" };
    await expect(getShippingEstimatesForAdmin(client({ data: row, error: null }))).resolves.toEqual({
      toBranch: 7000,
      toHome: 9000,
    });
  });

  it("si la lectura falla, lanza (la página muestra error.tsx)", async () => {
    await expect(
      getShippingEstimatesForAdmin(client({ data: null, error: { message: "fetch failed" } })),
    ).rejects.toThrow("No se pudieron leer los envíos estimados: fetch failed");
  });
});
