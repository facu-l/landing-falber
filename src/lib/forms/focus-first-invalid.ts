import { type RefObject, useEffect } from "react";

/*
 * Después de un error del servidor, el foco (y el scroll) van al primer campo inválido.
 * En el celular el botón queda abajo: sin esto, un error en los primeros campos queda
 * fuera de la pantalla y el cliente ve que "no pasó nada".
 *
 * Los campos inválidos ya se marcan con aria-invalid (Input, Select, los grupos de radios).
 */

const FIELD = "input, select, textarea";
const ENABLED_FIELD = "input:not(:disabled), select:not(:disabled), textarea:not(:disabled)";

/** Enfoca el primer campo con aria-invalid. En un fieldset, su primera opción habilitada. */
export function focusFirstInvalid(form: HTMLFormElement) {
  const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!invalid) return;

  // Un fieldset (grupo de radios) no recibe foco: va a la primera opción que se puede elegir.
  const target = invalid.matches(FIELD) ? invalid : invalid.querySelector<HTMLElement>(ENABLED_FIELD);
  target?.focus();
}

/**
 * Corre focusFirstInvalid cada vez que llegan errores por campo nuevos (cada respuesta
 * de la Server Action es un objeto nuevo, aunque los mensajes se repitan).
 */
export function useFocusFirstInvalid(form: RefObject<HTMLFormElement | null>, fieldErrors: object | undefined) {
  useEffect(() => {
    if (fieldErrors && form.current) focusFirstInvalid(form.current);
  }, [form, fieldErrors]);
}
