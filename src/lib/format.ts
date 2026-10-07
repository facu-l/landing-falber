const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** 14500 → "$ 14.500" (con espacio duro). En la tienda los precios van sin centavos. */
export function formatARS(amount: number): string {
  return ars.format(amount);
}

// Zona fija: el servidor (Netlify) corre en UTC y FALBER vende en La Plata.
const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "2026-10-07T00:30:00Z" → "06/10 21:30" (hora de Argentina). */
export function formatDateTime(iso: string): string {
  const part = Object.fromEntries(dateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  // padStart: en es-AR, ICU ignora "2-digit" en el día ("6/10").
  const two = (value: string) => value.padStart(2, "0");
  return `${two(part.day)}/${two(part.month)} ${two(part.hour)}:${two(part.minute)}`;
}
