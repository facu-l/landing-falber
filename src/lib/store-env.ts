import { required } from "./supabase/env";

/*
 * Formato de wa.me para Argentina: 54 + 9 + área + número (10 dígitos), sin "+",
 * sin el 0 del área ni el 15. Se valida al leerla porque un número mal cargado no
 * rompe nada visible: el botón de WhatsApp abre un chat con nadie.
 */
const WA_ME_AR = /^549\d{10}$/;

const NAME = "NEXT_PUBLIC_WHATSAPP_NUMBER";

export function parseWhatsAppNumber(value: string | undefined): string {
  const number = required(NAME, value);
  if (!WA_ME_AR.test(number)) {
    throw new Error(`${NAME} tiene que ser 549 + área + número, solo dígitos (ej. 5492215551234).`);
  }
  return number;
}

// Nombre literal: Next.js solo incrusta en el cliente los accesos escritos así.
export function whatsAppNumber(): string {
  return parseWhatsAppNumber(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
}
