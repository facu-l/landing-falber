import "server-only";
import { headers } from "next/headers";
import { stringField, TURNSTILE_FIELD, type TurnstileAction } from "@/lib/forms/form-data";
import { required } from "@/lib/supabase/env";
import { clientIp, hashClientKey } from "./client-key";
import { siteHostnames } from "./env-checks";
import { verifyTurnstile } from "./turnstile";

/*
 * Paso anti-bots común a las Server Actions públicas (pedidos y encargos):
 * Turnstile con la IP real y, si pasa, la clave anónima del cliente para el
 * límite por IP de la base (p_client_key, decisión 37).
 *
 * Va DESPUÉS de zod (decisión 35): el token sirve una sola vez.
 */

export type HumanCheck = { ok: true; clientKey: string } | { ok: false };

export async function verifyHumanRequest(formData: FormData, action: TurnstileAction): Promise<HumanCheck> {
  const ip = clientIp(await headers());
  const human = await verifyTurnstile(stringField(formData, TURNSTILE_FIELD), {
    secret: required("TURNSTILE_SECRET_KEY", process.env.TURNSTILE_SECRET_KEY),
    action,
    hostnames: siteHostnames(process.env.SITE_HOSTNAMES),
    remoteIp: ip,
  });
  if (!human) return { ok: false };

  return { ok: true, clientKey: hashClientKey(ip, required("IP_HASH_SECRET", process.env.IP_HASH_SECRET)) };
}
