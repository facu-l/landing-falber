import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/types/database";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { type ShippingRates, toShippingRates } from "./rates";

/** Tag de los envíos estimados. Lo invalida la acción de /admin/envios al guardar. */
export const SHIPPING_RATES_TAG = "shipping-rates";

/**
 * Envíos estimados, cacheados. Mismo criterio que getCatalog(): cliente anónimo sin
 * cookies (son iguales para todos) y cacheLife('minutes') por si se editan en Studio,
 * que no invalida el tag. Un error lanza: no se cachea, y el que llama decide.
 */
export async function getShippingRates(): Promise<ShippingRates> {
  "use cache";
  cacheTag(SHIPPING_RATES_TAG);
  cacheLife("minutes");

  const { url, publishableKey } = supabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.from("shipping_rates").select("*").single();
  if (error) throw new Error(`No se pudieron leer los envíos estimados: ${error.message}`);
  return toShippingRates(data);
}

/** Para el checkout: sin estimados se sigue comprando (son informativos). Se loguea. */
export async function getShippingRatesOrNull(): Promise<ShippingRates | null> {
  try {
    return await getShippingRates();
  } catch (error) {
    console.error("[checkout] sin envíos estimados", error);
    return null;
  }
}
