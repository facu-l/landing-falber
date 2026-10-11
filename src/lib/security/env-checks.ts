/*
 * Variables de entorno de la seguridad de los formularios, sin dependencias de servidor:
 * las usa verify-request (en cada envío) y next.config.ts (en el build de producción de
 * Netlify). Un valor mal cargado frena el deploy en vez de cortar las ventas con el
 * primer pedido real (decisión 87).
 */

// Un dominio tal como lo devuelve Cloudflare: sin esquema, puerto, barra ni punto final.
const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

// Secretos de prueba que publica Cloudflare (siempre pasa, siempre falla, token ya usado).
const TURNSTILE_TEST_SECRET = /^[123]x0{31}AA$/;

/** "falber.com.ar, falber.netlify.app" → ["falber.com.ar", "falber.netlify.app"]. Falla cerrado. */
export function siteHostnames(value: string | undefined): string[] {
  const hostnames = (value ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (hostnames.length === 0) {
    throw new Error("Falta SITE_HOSTNAMES: los dominios donde vale un token de Turnstile. Ver .env.example.");
  }
  const invalid = hostnames.find((hostname) => !HOSTNAME.test(hostname));
  if (invalid) {
    throw new Error(
      `SITE_HOSTNAMES: "${invalid}" no es un dominio. Va sin https://, sin puerto y sin barra (ej. falber.com.ar).`,
    );
  }
  return hostnames;
}

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * true solo con el Supabase local de desarrollo y CI (`supabase start`). next.config.ts lo usa
 * para habilitar las IPs locales en next/image: Next 16 las bloquea por defecto (SSRF) y en
 * local el bucket de fotos está en 127.0.0.1. Una URL inválida o ausente no es local.
 */
export function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return LOCAL_HOSTNAMES.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Solo en el build de producción de Netlify (CONTEXT=production; local, CI y previews no lo
 * definen así). El secreto se revisa si está: si Netlify no lo expone al build, en runtime
 * Turnstile igual falla cerrado.
 */
export function assertProductionEnv(env: Record<string, string | undefined>): void {
  if (env.CONTEXT !== "production") return;

  siteHostnames(env.SITE_HOSTNAMES);
  if (isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL de producción apunta a un Supabase local: next/image quedaría con las IPs locales habilitadas.",
    );
  }
  if (env.TURNSTILE_SECRET_KEY && TURNSTILE_TEST_SECRET.test(env.TURNSTILE_SECRET_KEY)) {
    throw new Error(
      "TURNSTILE_SECRET_KEY de producción es una clave de prueba de Cloudflare: con ella pasa cualquier token.",
    );
  }
}
