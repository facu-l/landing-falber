import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Opciones de las cookies de sesión de Supabase. Las usan los dos lugares que las
 * escriben: el cliente del servidor (server.ts) y el proxy de /admin (src/proxy.ts).
 *
 * - httpOnly: el JavaScript de la página no puede leer la sesión. Un XSS en la tienda
 *   no se lleva el acceso al panel. Se puede porque nada usa Supabase desde el
 *   navegador: si algún día hace falta, ese cliente necesitaría cookies legibles.
 * - secure solo en producción: en desarrollo el celular entra por la IP de la red
 *   local (http, sin certificado) y el navegador descartaría una cookie Secure.
 */
export function sessionCookieOptions(env = process.env.NODE_ENV): CookieOptionsWithName {
  return { path: "/", sameSite: "lax", httpOnly: true, secure: env === "production" };
}
