import { z } from "zod";

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
} as const;

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

  const fieldErrors: LoginFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as LoginField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { success: false, fieldErrors };
}
