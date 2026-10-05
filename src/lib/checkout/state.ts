import type { CheckoutFieldErrors } from "./schema";

/*
 * Estado que la Server Action devuelve al formulario (useActionState).
 * Vive fuera de actions.ts porque un archivo "use server" solo puede exportar
 * funciones async.
 */
export type CheckoutState =
  | { status: "idle" }
  | { status: "success"; orderId: string }
  | {
      status: "error";
      /** Error general (arriba del botón). */
      message?: string;
      fieldErrors?: CheckoutFieldErrors;
      /** Producto con problemas de stock, para señalarlo. */
      variantId?: string | null;
      /** Lo que escribió el cliente: React resetea el form después de la acción. */
      values: Record<string, string>;
    };

export const INITIAL_CHECKOUT_STATE: CheckoutState = { status: "idle" };
