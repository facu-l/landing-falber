import "server-only";
import { isAuthApiError, isAuthSessionMissingError, type AuthError, type User } from "@supabase/supabase-js";
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
 * Lo usan requireAdmin(), requireAdminAction() y el login (para mostrar "sin acceso" a una cuenta que no es admin).
 */
export async function getAdminStatus(): Promise<AdminStatus> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  // Auth sin responder (red, 5xx) no es "sin sesión": que lo muestre error.tsx.
  if (authError && !isNoSession(authError)) {
    throw new Error(`No se pudo verificar la sesión (getUser): ${authError.message}`);
  }
  if (!user) return { status: "anonymous", supabase };

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  // Un error de red no es "sin acceso": que lo muestre error.tsx.
  if (error) throw new Error(`No se pudo verificar el acceso (is_admin): ${error.message}`);

  return { status: isAdmin ? "admin" : "forbidden", supabase, user };
}

const TOO_MANY_REQUESTS = 429;

/**
 * Auth contestó que no hay una sesión válida: no hay cookie, o la que hay fue revocada o
 * es de un usuario borrado (4xx). Eso es "anonymous" y lleva al login, donde se puede
 * volver a entrar. Lanzar ahí dejaría al admin sin salida: el login también llama acá.
 *
 * El 429 (Auth limitando pedidos) no: la sesión sigue valiendo, es Auth que no responde.
 */
function isNoSession(error: AuthError) {
  if (isAuthSessionMissingError(error)) return true;
  return isAuthApiError(error) && error.status < 500 && error.status !== TOO_MANY_REQUESTS;
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

export const ADMIN_ACCESS_CHECK_FAILED = "No pudimos verificar tu acceso. Probá de nuevo en unos minutos.";

export type AdminActionAccess =
  | { ok: true; supabase: SupabaseServerClient; user: User }
  | { ok: false; message: string };

/**
 * requireAdmin() para las Server Actions con formulario: misma regla (primera línea,
 * sesión del usuario, sin admin al login), pero si no se puede verificar el acceso
 * (Auth o la base no responden) devuelve el error en vez de lanzar. Lanzar reemplaza la
 * página por error.tsx y el admin pierde lo que escribió.
 *
 * Solo getAdminStatus() va dentro del try: el redirect queda afuera y no hace falta
 * relanzarlo (sin unstable_rethrow).
 */
export async function requireAdminAction(): Promise<AdminActionAccess> {
  let access: AdminStatus;
  try {
    access = await getAdminStatus();
  } catch (error) {
    console.error("[admin] no se pudo verificar el acceso", error);
    return { ok: false, message: ADMIN_ACCESS_CHECK_FAILED };
  }

  if (access.status !== "admin") redirect(ADMIN_LOGIN_PATH);
  return { ok: true, supabase: access.supabase, user: access.user };
}
