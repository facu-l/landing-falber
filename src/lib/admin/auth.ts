import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_LOGIN_PATH = "/admin/login";
/** Logueado pero sin perfil de admin: el login lo explica y ofrece salir (no reintenta). */
export const FORBIDDEN_LOGIN_PATH = `${ADMIN_LOGIN_PATH}?motivo=sin-acceso`;

/**
 * Primera línea de cada Server Action y página del admin.
 *
 * - getUser() valida la sesión contra Supabase Auth (no confía solo en la cookie).
 * - is_admin() mira public.profiles con el rol del usuario.
 * - Devuelve el cliente con la sesión del usuario: RLS sigue decidiendo. Nunca service_role.
 *
 * El proxy (src/proxy.ts) solo refresca la sesión y redirige a quien no tiene una:
 * la seguridad está acá y en RLS.
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  // Un error de red no es "sin acceso": que lo muestre error.tsx.
  if (error) throw new Error(`No se pudo verificar el acceso (is_admin): ${error.message}`);
  if (!isAdmin) redirect(FORBIDDEN_LOGIN_PATH);

  return { supabase, user };
}
