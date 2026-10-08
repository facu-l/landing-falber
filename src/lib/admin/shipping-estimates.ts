import { type ShippingRates, toShippingRates } from "@/lib/shipping/rates";
import type { createClient } from "@/lib/supabase/server";
import { parseShippingCost } from "./shipping";

/*
 * Envíos estimados en /admin/envios: los dos montos que el checkout muestra debajo de
 * "Envío a domicilio". Reusa el parser del costo de envío de un pedido (mismo formato
 * y tope), pero acá vacío no vale: es ambiguo. 0 sí: el checkout muestra "gratis".
 */

export const SHIPPING_ESTIMATE_REQUIRED = "Escribí el envío estimado en pesos (ej. 7000 o 7.000).";
export const SHIPPING_ESTIMATES_SAVE_ERROR = "No pudimos guardar los envíos estimados. Probá de nuevo en unos segundos.";
export const SHIPPING_ESTIMATES_NOT_SAVED = "No pudimos guardar los envíos estimados. Recargá la página y probá de nuevo.";

export type ShippingEstimateField = keyof ShippingRates;
export type ShippingEstimateFieldErrors = Partial<Record<ShippingEstimateField, string>>;

export type ShippingEstimatesParseResult =
  | { success: true; data: ShippingRates }
  | { success: false; fieldErrors: ShippingEstimateFieldErrors };

const FIELDS: readonly ShippingEstimateField[] = ["toBranch", "toHome"];

export function parseShippingEstimates(values: Record<string, string | undefined>): ShippingEstimatesParseResult {
  const data: Partial<ShippingRates> = {};
  const fieldErrors: ShippingEstimateFieldErrors = {};

  for (const field of FIELDS) {
    const parsed = parseShippingCost(values[field] ?? "");
    if (!parsed.success) fieldErrors[field] = parsed.error;
    else if (parsed.value === null) fieldErrors[field] = SHIPPING_ESTIMATE_REQUIRED;
    else data[field] = parsed.value;
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return { success: true, data: data as ShippingRates };
}

/** Estado de la Server Action (useActionState). Fuera de actions.ts: un archivo "use server" solo exporta funciones async. */
export type ShippingEstimatesState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: ShippingEstimateFieldErrors;
      /** Lo escrito: React resetea el form después de la acción. */
      values: Record<ShippingEstimateField, string>;
    };

export const INITIAL_SHIPPING_ESTIMATES_STATE: ShippingEstimatesState = { status: "idle" };

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Lectura para la página del admin, con la sesión del usuario y sin caché (muestra lo guardado). */
export async function getShippingEstimatesForAdmin(supabase: SessionClient): Promise<ShippingRates> {
  const { data, error } = await supabase.from("shipping_rates").select("*").single();
  if (error) throw new Error(`No se pudieron leer los envíos estimados: ${error.message}`);
  return toShippingRates(data);
}
