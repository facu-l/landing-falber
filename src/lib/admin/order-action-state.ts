/*
 * Estado que devuelven las Server Actions del detalle de un pedido (useActionState).
 * Fuera de actions.ts porque un archivo "use server" solo exporta funciones async.
 */
export type OrderActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const INITIAL_ORDER_ACTION_STATE: OrderActionState = { status: "idle" };
