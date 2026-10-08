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

/** 0 lo carga el admin a propósito (una promo): se muestra como gratis, no como "$ 0". */
export function shippingEstimateLines(rates: ShippingRates): string[] {
  return [estimateLine("sucursal", rates.toBranch), estimateLine("domicilio", rates.toHome)];
}

function estimateLine(destination: "sucursal" | "domicilio", amount: number): string {
  if (amount === 0) return `Envío a ${destination}: gratis`;
  return `Envío estimado a ${destination} ${formatARS(amount)}`;
}
