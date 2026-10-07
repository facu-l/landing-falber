"use server";

import { redirect } from "next/navigation";
import { loginError, parseLogin } from "@/lib/admin/login";
import type { LoginState } from "@/lib/admin/login-state";
import { ADMIN_LOGIN_PATH, ADMIN_ORDERS_PATH } from "@/lib/admin/paths";
import { formValues } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

/*
 * Las dos únicas acciones del admin sin requireAdmin(): son las que crean y cierran
 * la sesión. No leen ni escriben datos de la tienda. Usan el cliente de la sesión
 * (cookies), nunca service_role. El registro público está desactivado (decisión 21).
 */

/** Inicia sesión con email y contraseña. Si sale bien, redirige a los pedidos. */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const values = formValues(formData);
  const email = values.email ?? "";

  const parsed = parseLogin(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const mapped = loginError(error.code);
    if (!mapped.known) console.error("[admin] signInWithPassword falló", error);
    return { status: "error", message: mapped.message, values: { email } };
  }

  // Si la cuenta no es admin, requireAdmin() la devuelve al login, que muestra "sin acceso".
  redirect(ADMIN_ORDERS_PATH);
}

/** Cierra solo esta sesión: sin scope, supabase-js usa "global" y cierra las de todos los dispositivos. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(ADMIN_LOGIN_PATH);
}
