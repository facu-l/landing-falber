/*
 * Estilo de los ítems de la navegación del panel (links y el botón "Salir").
 * En un módulo común, no en AdminNavLink ("use client"): el layout es de servidor y
 * no conviene que importe valores de un módulo cliente.
 */
export const ADMIN_NAV_ITEM_CLASSES =
  "inline-flex min-h-11 items-center text-label uppercase text-text-secondary transition-colors duration-150 hover:text-text";
