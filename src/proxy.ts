import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminProxyRedirect } from "@/lib/admin/paths";
import { supabasePublicEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Proxy de Next 16 (antes "middleware"). Corre solo en /admin (ver `matcher`):
 *
 * 1. Refresca la sesión de Supabase en cada navegación del admin. Los Server
 *    Components no pueden escribir cookies; sin esto el token vence a mitad de uso.
 * 2. Chequeo optimista: sin sesión, al login. NO es la seguridad: eso es
 *    requireAdmin() en cada página y acción, y RLS en la base.
 *
 * La tienda pública no tiene sesión: correrlo ahí solo sumaría una llamada a Auth
 * en cada visita.
 */
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = supabasePublicEnv();
  let response = NextResponse.next({ request });
  // Headers que pide Supabase al escribir cookies (Cache-Control): van también en un redirect.
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // La request también lleva las cookies nuevas: así las ve el render de esta misma navegación.
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Cache-Control y compañía: una respuesta con la sesión de alguien no se cachea.
        cacheHeaders = headers;
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Dispara el refresco del token si venció. getClaims valida el JWT.
  const { data } = await supabase.auth.getClaims();

  const destination = adminProxyRedirect(request.nextUrl.pathname, Boolean(data?.claims));
  if (!destination) return response;

  const redirect = NextResponse.redirect(new URL(destination, request.url));
  // Si el refresco borró cookies (sesión inválida), el redirect también las borra.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const [key, value] of Object.entries(cacheHeaders)) redirect.headers.set(key, value);
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*"],
};
