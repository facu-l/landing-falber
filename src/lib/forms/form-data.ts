/*
 * Lectura de FormData en las Server Actions de la tienda.
 */

/**
 * Input oculto con el token de Turnstile ("response-field": false en el widget, decisión 38).
 * Vive acá y no en lib/security porque lo usan el formulario (cliente) y la acción (servidor).
 */
export const TURNSTILE_FIELD = "cf-turnstile-response";

/**
 * Los campos de texto del formulario, para devolvérselos al cliente si algo falla:
 * React resetea el form después de la acción y sin esto se pierde lo escrito.
 * Deja afuera los campos internos de Next ($ACTION_...) y los de `omit` (ej. el token de Turnstile).
 */
export function formValues(formData: FormData, omit: readonly string[] = []): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$ACTION") && !omit.includes(key)) values[key] = value;
  }
  return values;
}

export function stringField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}
