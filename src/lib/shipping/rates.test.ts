// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatARS } from "@/lib/format";
import { shippingEstimateLines, toShippingRates } from "./rates";

describe("toShippingRates", () => {
  it("pasa la fila de shipping_rates a montos con nombre de la app", () => {
    expect(
      toShippingRates({ estimate_to_branch: 7000, estimate_to_home: 9000, id: true, updated_at: "2026-10-08T12:00:00Z" }),
    ).toEqual({ toBranch: 7000, toHome: 9000 });
  });
});

describe("shippingEstimateLines", () => {
  it("una línea por destino, con el formato de pesos de la tienda", () => {
    expect(shippingEstimateLines({ toBranch: 7000, toHome: 9000 })).toEqual([
      `Envío estimado a sucursal ${formatARS(7000)}`,
      `Envío estimado a domicilio ${formatARS(9000)}`,
    ]);
  });
});
