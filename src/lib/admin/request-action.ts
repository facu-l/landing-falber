/*
 * Estado y mensajes de la acción que cambia el estado de un encargo (useActionState).
 * Fuera de actions.ts porque un archivo "use server" solo exporta funciones async.
 */

export type RequestActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const INITIAL_REQUEST_ACTION_STATE: RequestActionState = { status: "idle" };

/** El update filtra por el estado que el admin veía y no tocó ninguna fila. */
export const REQUEST_CHANGED =
  "El encargo cambió de estado mientras lo mirabas. Recargá la página para verlo actualizado.";

/** Datos del form inválidos (id, estado), o el encargo no existe. */
export const REQUEST_NOT_FOUND = "No encontramos el encargo. Recargá la lista de encargos.";

export const REQUEST_SAVE_FAILED = "No pudimos guardar el cambio. Probá de nuevo en unos segundos.";
