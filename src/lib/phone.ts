/*
 * Normaliza un celular argentino al formato que guarda la base (E.164 con el 9 de
 * móvil): +54 9 + área + número = "+549" + 10 dígitos.
 *
 * En Argentina, área + número siempre suman 10 dígitos, y los códigos de área
 * empiezan con 1, 2 o 3 (11, 221, 2355). La gente agrega:
 *   - el 0 del área (0221)       → se saca
 *   - el 15 después del área     → se saca (wa.me no lo acepta)
 *   - +54, con o sin el 9        → se saca y se vuelve a poner completo
 *
 * Devuelve null si no es un celular argentino válido.
 */

const ALLOWED_CHARS = /^[\d\s()+.-]+$/;
const NATIONAL_NUMBER = /^[1-3]\d{9}$/;
// Los códigos de área tienen 2, 3 o 4 dígitos: ahí puede estar el 15.
const AREA_CODE_LENGTHS = [2, 3, 4];

export function normalizeArgentineWhatsApp(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !ALLOWED_CHARS.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("54") && digits.length > 10) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);

  const national = digits.length === 12 ? withoutFifteen(digits) : digits;
  if (!national || !NATIONAL_NUMBER.test(national)) return null;

  return `+549${national}`;
}

/*
 * Con el 15 quedan 12 dígitos: se busca "15" justo después de un área de 2, 3 o 4
 * dígitos, de la más corta a la más larga. Ejemplos:
 *   11 15 1234 5678  → "15" en la posición 2
 *   221 15 555 1234  → "15" en la posición 3 (en la 2 hay "11")
 *   2355 15 48 1449  → "15" en la posición 4
 */
function withoutFifteen(digits: string): string | null {
  for (const areaLength of AREA_CODE_LENGTHS) {
    if (digits.slice(areaLength, areaLength + 2) === "15") {
      return digits.slice(0, areaLength) + digits.slice(areaLength + 2);
    }
  }
  return null;
}
