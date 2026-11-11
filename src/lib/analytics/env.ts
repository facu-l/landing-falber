/**
 * IDs de medición, opcionales a propósito: sin ellos (local, CI, o mientras no estén
 * creadas las cuentas) el sitio funciona igual, solo sin analítica. Nombre literal:
 * Next.js solo incrusta en el cliente los accesos a process.env.NEXT_PUBLIC_* escritos así.
 */
export function gaMeasurementId(): string | null {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null;
}

export function clarityProjectId(): string | null {
  return process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || null;
}
