import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { required, supabasePublicEnv } from "./env";

/**
 * Cliente con service_role: SALTEA RLS.
 *
 * Usarlo SOLO para las RPC que la DB reserva al servidor:
 * create_order, create_perfume_request y get_order_summary.
 * Nunca en acciones del admin (esas usan ./server con la sesión del usuario).
 *
 * "server-only" hace fallar la build si se importa desde código de cliente,
 * así la clave no puede terminar en el navegador.
 */
export function createServiceClient() {
  const { url } = supabasePublicEnv();
  const serviceRoleKey = required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
