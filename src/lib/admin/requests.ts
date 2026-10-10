import type { createClient } from "@/lib/supabase/server";
import type { RequestStatus } from "./request-list";

/*
 * Lecturas de encargos del admin. Mismo contrato que orders.ts: reciben el cliente de
 * requireAdmin() y corren con la sesión y RLS ("admin: read perfume_requests").
 * Nunca service_role. Sin 'use cache': el panel siempre muestra el estado actual.
 */

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Encargos que todavía piden algo del admin: se muestran todos, sin tope. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ["pending", "contacted", "quoted", "sourcing"];
/** Historial: completados y cancelados. */
export const CLOSED_REQUEST_STATUSES: RequestStatus[] = ["completed", "cancelled"];
export const CLOSED_REQUESTS_LIMIT = 100;

// Un solo literal: supabase-js infiere el tipo de la fila desde el texto del select.
// customers: el WhatsApp para contestarle ("admin: read customers").
const LIST_SELECT =
  "id, customer_name, perfume_name, brand, presentation, note, status, created_at, customers ( whatsapp )";

/** Todos los abiertos y los últimos cerrados, en dos consultas (índice perfume_requests_status_idx). */
export async function listAdminRequests(supabase: SessionClient) {
  const byDate = { ascending: false } as const;
  const [open, closed] = await Promise.all([
    supabase.from("perfume_requests").select(LIST_SELECT).in("status", OPEN_REQUEST_STATUSES).order("created_at", byDate),
    supabase
      .from("perfume_requests")
      .select(LIST_SELECT)
      .in("status", CLOSED_REQUEST_STATUSES)
      .order("created_at", byDate)
      .limit(CLOSED_REQUESTS_LIMIT),
  ]);

  const error = open.error ?? closed.error;
  if (error) throw new Error(`No se pudieron leer los encargos: ${error.message}`);
  const closedRequests = closed.data ?? [];
  return {
    requests: [...(open.data ?? []), ...closedRequests],
    closedTruncated: closedRequests.length === CLOSED_REQUESTS_LIMIT,
  };
}

export type AdminRequestListItem = Awaited<ReturnType<typeof listAdminRequests>>["requests"][number];

/**
 * Pendientes, para el número al lado de "Encargos" en la navegación. head: true cuenta
 * sin traer filas. Si falla devuelve 0: es un aviso, no puede tirar abajo el panel.
 */
export async function countPendingRequests(supabase: SessionClient): Promise<number> {
  const { count, error } = await supabase
    .from("perfume_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("[admin] no se pudieron contar los encargos pendientes", error.message);
    return 0;
  }
  return count ?? 0;
}
