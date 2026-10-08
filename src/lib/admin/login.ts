import { z } from "zod";
import { firstFieldErrors } from "@/lib/forms/field-errors";

/*
 * Validación del login del admin (/admin/login). Solo da errores por campo y en
 * castellano antes de llamar a Supabase Auth, que es quien decide.
 */

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Escribí un email válido.")),
  // Sin trim: una contraseña puede tener espacios.
  password: z.string().min(1, "Escribí tu contraseña."),
});

export type LoginData = z.output<typeof loginSchema>;
export type LoginField = keyof z.input<typeof loginSchema>;
export type LoginFieldErrors = Partial<Record<LoginField, string>>;

export type LoginParseResult = { success: true; data: LoginData } | { success: false; fieldErrors: LoginFieldErrors };

/*
 * Errores de Supabase Auth (error.code) → mensajes. Credenciales incorrectas no dice
 * si falló el email o la contraseña: así no se puede averiguar qué emails existen.
 */
export const LOGIN_ERRORS = {
  invalid_credentials: "El email o la contraseña no coinciden.",
  over_request_rate_limit: "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  // Turnstile no dio token (o venció): mismo texto que el checkout y los encargos, con el botón de este formulario.
  captcha_failed: "No pudimos verificar tu navegador. Esperá unos segundos y volvé a tocar Ingresar.",
} as const;

/**
 * El formulario llegó sin token: lo más común es que el widget invisible todavía no
 * terminara (Enter apenas se abre la página); si se repite, Turnstile no carga (bloqueador
 * de anuncios, DNS). Llamar a Auth sin token solo gastaría el límite de intentos.
 */
export const TURNSTILE_MISSING =
  "Todavía no pudimos verificar tu navegador. Esperá unos segundos y volvé a tocar Ingresar. Si se repite, desactivá el bloqueador de anuncios o probá con otro navegador.";

export const GENERIC_LOGIN_ERROR = "No pudimos iniciar sesión. Probá de nuevo en unos minutos.";

/** known = false: no es un error esperado (red, configuración). Hay que loguearlo. */
export function loginError(code: string | undefined): { message: string; known: boolean } {
  if (code && Object.hasOwn(LOGIN_ERRORS, code)) {
    return { message: LOGIN_ERRORS[code as keyof typeof LOGIN_ERRORS], known: true };
  }
  return { message: GENERIC_LOGIN_ERROR, known: false };
}

export function parseLogin(rawInput: Record<string, unknown>): LoginParseResult {
  const result = loginSchema.safeParse({ email: "", password: "", ...rawInput });
  if (result.success) return { success: true, data: result.data };

  return { success: false, fieldErrors: firstFieldErrors<LoginField>(result.error.issues) };
}
