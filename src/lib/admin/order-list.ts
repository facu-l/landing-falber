import type { OrderStatus } from "./order-transitions";

/*
 * Reglas de la lista de pedidos del admin (/admin/pedidos). Puras: la hora entra
 * como parámetro para poder probarlas.
 */

const HOUR_MS = 3_600_000;

/** pg_cron cancela los pendientes de más de 48 h (supabase/migrations/0002_schedule_jobs.sql). */
export const AUTO_CANCEL_HOURS = 48;
/** Desde cuándo se avisa en la lista que un pendiente se va a cancelar solo. */
export const AUTO_CANCEL_WARNING_HOURS = 24;

type ListedOrder = { status: OrderStatus; created_at: string };

const time = (order: ListedOrder) => new Date(order.created_at).getTime();

/**
 * Pendientes primero, del más viejo al más nuevo (el de arriba es el más cerca de
 * cancelarse solo). Después el resto, del más nuevo al más viejo.
 */
export function sortOrdersForAdmin<T extends ListedOrder>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const aPending = a.status === "pending";
    const bPending = b.status === "pending";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return aPending ? time(a) - time(b) : time(b) - time(a);
  });
}

/**
 * Aviso de un pendiente que pg_cron va a cancelar. hoursLeft redondea para abajo:
 * es mejor que el admin vea menos tiempo del que hay. 0 = menos de una hora (o ya
 * vencido y esperando la próxima corrida del cron, que es cada hora).
 */
export function autoCancelWarning(order: ListedOrder, now: Date): { hoursLeft: number } | null {
  if (order.status !== "pending") return null;

  const ageHours = (now.getTime() - time(order)) / HOUR_MS;
  if (ageHours < AUTO_CANCEL_WARNING_HOURS) return null;

  return { hoursLeft: Math.max(0, Math.floor(AUTO_CANCEL_HOURS - ageHours)) };
}
