/*
 * Usuarios de Supabase Auth para desarrollo local y E2E. NUNCA contra la nube:
 * assertLocalSupabase corta antes de cualquier llamada.
 *
 * - Los E2E (e2e/admin-helpers.ts) crean usuarios nuevos por test con contraseñas al azar.
 * - `npm run db:admin [email]` crea o actualiza un admin local para probar el panel a mano
 *   y muestra la contraseña en tu terminal. Por defecto: admin@falber.test.
 *
 * Por qué así y no en supabase/seed.sql: insertar en auth.users depende de columnas
 * internas de GoTrue (tokens en null rompen el login) que cambian con el CLI. La API de
 * admin de Auth es pública y estable.
 *
 * Se corre con Node 24 directo (sin compilar): solo sintaxis de TypeScript que se borra.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Database } from "../src/types/database";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function assertLocalSupabase(url: string | undefined): void {
  let host: string;
  try {
    host = new URL(url ?? "").hostname;
  } catch {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL (o no es una URL). Copiá .env.example a .env.local.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`Este script corre solo contra Supabase local (127.0.0.1 o localhost), no contra ${host}.`);
  }
}

export const randomPassword = () => randomBytes(18).toString("base64url");

/** Cliente con service_role del Supabase local. Lee las variables del entorno. */
export function localAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabase(url);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (npx supabase status).");

  return createClient<Database>(url!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type LocalUser = { email: string; password: string; admin: boolean };

/**
 * Crea el usuario (o le pone la contraseña nueva si ya existe) con el email confirmado.
 * admin: true le crea la fila en public.profiles (lo que is_admin() mira).
 */
export async function ensureLocalUser({ email, password, admin }: LocalUser): Promise<string> {
  const supabase = localAdminClient();

  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  let userId = created.data.user?.id;

  if (created.error) {
    if (created.error.code !== "email_exists") throw created.error;
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    userId = data.users.find((u) => u.email === email)?.id;
    if (!userId) throw new Error(`El email ${email} existe pero no aparece en la lista de usuarios.`);
    const updated = await supabase.auth.admin.updateUserById(userId, { password });
    if (updated.error) throw updated.error;
  }

  if (admin) {
    const { error } = await supabase.from("profiles").upsert({ id: userId!, display_name: "Admin local" });
    if (error) throw error;
  }

  return userId!;
}

// npm run db:admin [email]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const email = process.argv[2] ?? "admin@falber.test";
  const password = randomPassword();
  ensureLocalUser({ email, password, admin: true })
    .then(() => {
      console.log(`Admin local listo: ${email}`);
      console.log(`Contraseña: ${password}`);
      console.log("Ingresá en http://localhost:3000/admin/login");
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
