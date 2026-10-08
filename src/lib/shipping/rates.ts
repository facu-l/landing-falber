import { formatARS } from "@/lib/format";
import type { Database } from "@/types/database";

/*
 * Envíos estimados que muestra el checkout debajo de "Envío a domicilio". Son solo
 * informativos: el pedido nace "a coordinar" y el admin carga el costo real.
 * Los montos viven en la tabla shipping_rates y se editan en /admin/envios.
 */

export type ShippingRates = { toBranch: number; toHome: number };

type ShippingRatesRow = Database["public"]["Tables"]["shipping_rates"]["Row"];

export function toShippingRates(row: ShippingRatesRow): ShippingRates {
  return { toBranch: row.estimate_to_branch, toHome: row.estimate_to_home };
}

export function shippingEstimateLines(rates: ShippingRates): string[] {
  return [
    `Envío estimado a sucursal ${formatARS(rates.toBranch)}`,
    `Envío estimado a domicilio ${formatARS(rates.toHome)}`,
  ];
}
