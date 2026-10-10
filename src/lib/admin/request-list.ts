import { Constants, type Database } from "@/types/database";

/*
 * Reglas de la lista de encargos del admin (/admin/encargos). Puras: se prueban sin base.
 */

export type RequestStatus = Database["public"]["Enums"]["request_status"];

/** En el orden del flujo: así se listan en el select de estado. */
export const REQUEST_STATUSES: readonly RequestStatus[] = Constants.public.Enums.request_status;

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pendiente",
  contacted: "Contactado",
  quoted: "Cotizado",
  sourcing: "En búsqueda",
  completed: "Completado",
  cancelled: "Cancelado",
};

type ListedRequest = { status: RequestStatus; created_at: string };

const time = (request: ListedRequest) => new Date(request.created_at).getTime();

/**
 * Pendientes primero, del más viejo al más nuevo (el de arriba es el que más espera).
 * Después el resto, del más nuevo al más viejo. Mismo criterio que la lista de pedidos.
 */
export function sortRequestsForAdmin<T extends ListedRequest>(requests: readonly T[]): T[] {
  return [...requests].sort((a, b) => {
    const aPending = a.status === "pending";
    const bPending = b.status === "pending";
    if (aPending !== bPending) return aPending ? -1 : 1;
    return aPending ? time(a) - time(b) : time(b) - time(a);
  });
}

/**
 * Estados a los que se puede pasar. La base no limita las transiciones de un encargo
 * (a diferencia de los pedidos, no tocan stock): cualquier otro estado, para poder
 * corregir un cambio equivocado.
 */
export function nextRequestStatuses(current: RequestStatus): RequestStatus[] {
  return REQUEST_STATUSES.filter((status) => status !== current);
}
