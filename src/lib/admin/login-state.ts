import type { LoginFieldErrors } from "./login";

/*
 * Estado que la Server Action del login devuelve al formulario (useActionState).
 * Fuera de actions.ts porque un archivo "use server" solo exporta funciones async.
 * Un login exitoso no tiene estado: la acción redirige al panel.
 */
export type LoginState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: LoginFieldErrors;
      /** Solo el email: la contraseña nunca vuelve al navegador. */
      values: { email: string };
    };

export const INITIAL_LOGIN_STATE: LoginState = { status: "idle" };
