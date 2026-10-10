import type { RequestFieldErrors } from "./schema";

/*
 * Estado que la Server Action de /encargos devuelve al formulario (useActionState).
 * Vive fuera de actions.ts porque un archivo "use server" solo puede exportar
 * funciones async.
 */
export type RequestState =
  | { status: "idle" }
  | {
      status: "success";
      perfumeName: string;
      /** wa.me de la tienda con el encargo: el aviso, porque la base no notifica a nadie. */
      whatsappUrl: string;
    }
  | {
      status: "error";
      /** Error general (arriba del botón). */
      message?: string;
      fieldErrors?: RequestFieldErrors;
      /** Lo que escribió el cliente: React resetea el form después de la acción. */
      values: Record<string, string>;
    };

export const INITIAL_REQUEST_STATE: RequestState = { status: "idle" };
