import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_LOGIN_PATH } from "./paths";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AdminStatus =
  | { status: "anonymous"; supabase: SupabaseServerClient }
  | { status: "forbidden"; supabase: SupabaseServerClient; user: User }
  | { status: "admin"; supabase: SupabaseServerClient; user: User };

/**
 * Quién está del otro lado, según la sesión (no según la URL):
 * - getUser() valida la sesión contra Supabase Auth (no confía solo en la cookie).
 * - is_admin() mira public.profiles con el rol del usuario.
 * Lo usan requireAdmin() y el login (para mostrar "sin acceso" a una cuenta que no es admin).
 */
export async function getAdminStatus(): Promise<AdminStatus> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous", supabase };

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  // Un error de red no es "sin acceso": que lo muestre error.tsx.
  if (error) throw new Error(`No se pudo verificar el acceso (is_admin): ${error.message}`);

  return { status: isAdmin ? "admin" : "forbidden", supabase, user };
}

/**
 * Primera línea de cada Server Action y página del panel.
 * Devuelve el cliente con la sesión del usuario: RLS sigue decidiendo. Nunca service_role.
 * Sin sesión o sin perfil de admin, al login (que muestra el formulario o "sin acceso").
 *
 * El proxy (src/proxy.ts) solo refresca la sesión y redirige a quien no tiene una:
 * la seguridad está acá y en RLS.
 */
export async function requireAdmin() {
  const access = await getAdminStatus();
  if (access.status !== "admin") redirect(ADMIN_LOGIN_PATH);
  return { supabase: access.supabase, user: access.user };
}
