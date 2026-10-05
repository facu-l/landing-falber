import "server-only";

/*
 * Verificación de Cloudflare Turnstile en el servidor (el widget del navegador
 * solo entrega un token; sin esta llamada no protege nada).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Falla cerrado: si Cloudflare no responde o responde algo raro, el pedido no
 * pasa. Un pedido rechazado se reintenta; un bot que pasa no se deshace.
 */

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const TIMEOUT_MS = 5000;

type VerifyOptions = {
  secret: string;
  remoteIp?: string;
  /** Inyectable para los tests. */
  fetchImpl?: typeof fetch;
};

export async function verifyTurnstile(
  token: string | null,
  { secret, remoteIp, fetchImpl = fetch }: VerifyOptions,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch (error) {
    console.error("[turnstile] no se pudo verificar el token", error);
    return false;
  }
}
