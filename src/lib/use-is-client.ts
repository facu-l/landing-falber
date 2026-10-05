import { useSyncExternalStore } from "react";

const noop = () => () => {};

/*
 * false en el servidor y durante la hidratación; true después.
 * Sirve para no mostrar un estado del servidor que es falso en el navegador
 * (ej. "Tu carrito está vacío" antes de leer localStorage).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
