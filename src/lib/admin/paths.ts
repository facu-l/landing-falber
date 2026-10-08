/*
 * Rutas del admin. Sin dependencias de servidor: las usan el proxy, requireAdmin y las páginas.
 */

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_ORDERS_PATH = "/admin/pedidos";

const isAdminPath = (pathname: string) => pathname === "/admin" || pathname.startsWith("/admin/");

/**
 * Chequeo optimista del proxy: solo mira si hay sesión. Si la cuenta es admin lo
 * decide requireAdmin() en cada página y requireAdminAction() en cada acción (y RLS en la base).
 * null = dejar pasar.
 */
export function adminProxyRedirect(pathname: string, hasSession: boolean): string | null {
  if (!isAdminPath(pathname) || pathname === ADMIN_LOGIN_PATH) return null;
  return hasSession ? null : ADMIN_LOGIN_PATH;
}
