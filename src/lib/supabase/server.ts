import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { supabasePublicEnv } from "./env";

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 * Usa la sesión del usuario (cookies), así que RLS decide qué puede hacer.
 * Es el que usan las acciones del admin: nunca service_role ahí.
 */
export async function createClient() {
  const { url, publishableKey } = supabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component, donde las cookies son de solo lectura.
          // No pasa nada: src/proxy.ts refresca la sesión en cada navegación de /admin,
          // y una Server Action sí puede escribirlas.
        }
      },
    },
  });
}
