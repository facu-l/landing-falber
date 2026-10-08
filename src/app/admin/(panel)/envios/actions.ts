"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdminAction } from "@/lib/admin/auth";
import {
  parseShippingEstimates,
  SHIPPING_ESTIMATES_NOT_SAVED,
  SHIPPING_ESTIMATES_SAVE_ERROR,
  type ShippingEstimatesState,
} from "@/lib/admin/shipping-estimates";
import { loggableDbError } from "@/lib/db-errors";
import { formValues } from "@/lib/forms/form-data";
import { SHIPPING_RATES_TAG } from "@/lib/shipping/queries";

/**
 * Guarda los envíos estimados que muestra el checkout. requireAdminAction() primero y
 * el cliente de la sesión: RLS y los permisos de columna deciden (solo los dos montos).
 * Los checks de la base repiten el tope del parser.
 */
export async function updateShippingEstimates(
  _prev: ShippingEstimatesState,
  formData: FormData,
): Promise<ShippingEstimatesState> {
  const access = await requireAdminAction();

  const raw = formValues(formData);
  const values = { toBranch: raw.toBranch ?? "", toHome: raw.toHome ?? "" };
  if (!access.ok) return { status: "error", message: access.message, values };

  const parsed = parseShippingEstimates(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const { data, error } = await access.supabase
    .from("shipping_rates")
    .update({ estimate_to_branch: parsed.data.toBranch, estimate_to_home: parsed.data.toHome })
    .eq("id", true)
    // select: sin él, 0 filas (RLS) "se actualiza" sin error.
    .select("id");

  if (error) {
    console.error("[admin] guardar los envíos estimados falló", loggableDbError(error));
    return { status: "error", message: SHIPPING_ESTIMATES_SAVE_ERROR, values };
  }
  if (!data?.length) return { status: "error", message: SHIPPING_ESTIMATES_NOT_SAVED, values };

  // El checkout los lee cacheados: que vea los montos nuevos ya.
  updateTag(SHIPPING_RATES_TAG);
  refresh();
  return { status: "success", message: "Envíos estimados guardados." };
}
