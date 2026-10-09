import "server-only";
import type { TurnstileAction } from "@/lib/forms/form-data";

/*
 * Verificación de Cloudflare Turnstile en el servidor (el widget del navegador
 * solo entrega un token; sin esta llamada no protege nada).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Falla cerrado: si Cloudflare no responde o responde algo raro, el pedido no
 * pasa. Un pedido rechazado se reintenta; un bot que pasa no se deshace.
 *
 * Un token vale solo para la acción y el dominio donde se resolvió (decisión 87):
 * uno de /checkout no sirve en /encargos, ni uno de un Deploy Preview en producción.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TIMEOUT_MS = 5000;

type VerifyOptions = {
  secret: string;
  /** La acción que manda el widget del formulario que se está procesando. */
  action: TurnstileAction;
  /** Dominios donde se puede haber resuelto el token (SITE_HOSTNAMES). */
  hostnames: readonly string[];
  remoteIp?: string;
  /** Inyectable para los tests. */
  fetchImpl?: typeof fetch;
};

type SiteverifyResult = {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
  metadata?: { result_with_testing_key?: unknown };
};

export async function verifyTurnstile(
  token: string | null,
  { secret, action, hostnames, remoteIp, fetchImpl = fetch }: VerifyOptions,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  let result: SiteverifyResult;
  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    result = (await response.json()) as SiteverifyResult;
  } catch (error) {
    console.error("[turnstile] no se pudo verificar el token", error);
    return false;
  }

  if (result.success !== true) return false;

  // El secreto de prueba (local, CI y E2E) no devuelve action y responde hostname
  // "example.com": no hay nada que atar. Lo marca el secreto, no el token, así que
  // con el secreto real de producción nunca se cumple.
  if (result.metadata?.result_with_testing_key === true) return true;

  const sameAction = result.action === action;
  const knownHost = typeof result.hostname === "string" && hostnames.includes(result.hostname);
  if (!sameAction || !knownHost) {
    console.warn("[turnstile] token de otra acción o dominio", {
      expected: action,
      action: result.action,
      hostname: result.hostname,
    });
    return false;
  }
  return true;
}

/** "falber.com.ar, falber.netlify.app" → ["falber.com.ar", "falber.netlify.app"]. */
export function parseHostnames(value: string): string[] {
  return value
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
}
