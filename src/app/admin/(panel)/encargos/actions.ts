"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/admin/auth";
import {
  REQUEST_CHANGED,
  REQUEST_NOT_FOUND,
  REQUEST_SAVE_FAILED,
  type RequestActionState,
} from "@/lib/admin/request-action";
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, type RequestStatus } from "@/lib/admin/request-list";
import { loggableDbError } from "@/lib/db-errors";
import { formValues } from "@/lib/forms/form-data";

/*
 * Acciones de /admin/encargos. Empiezan con requireAdminAction() y escriben con el
 * cliente de la sesión (RLS + permiso de columna: solo status). Nunca service_role.
 */

const requestStatus = z.enum(REQUEST_STATUSES as [RequestStatus, ...RequestStatus[]]);

const statusChange = z
  .object({ requestId: z.uuid(), fromStatus: requestStatus, status: requestStatus })
  .refine((change) => change.status !== change.fromStatus);

/**
 * Cambia el estado de un encargo. Compare-and-set, como en pedidos: el update filtra
 * por el estado que el admin estaba viendo, así una pestaña vieja no pisa un cambio.
 * No toca stock ni el catálogo: sin updateTag.
 */
export async function updateRequestStatus(_prev: RequestActionState, formData: FormData): Promise<RequestActionState> {
  const access = await requireAdminAction();
  if (!access.ok) return { status: "error", message: access.message };

  const parsed = statusChange.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", message: REQUEST_NOT_FOUND };
  const { requestId, fromStatus, status } = parsed.data;

  // select: sin él, 0 filas (no existe, RLS o cambió de estado) "se actualiza" sin error.
  const { data, error } = await access.supabase
    .from("perfume_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("status", fromStatus)
    .select("id");

  if (error) {
    console.error("[admin] cambiar el estado del encargo falló", loggableDbError(error));
    return { status: "error", message: REQUEST_SAVE_FAILED };
  }
  if (!data?.length) return { status: "error", message: REQUEST_CHANGED };

  refresh();
  return { status: "success", message: `Estado actualizado: ${REQUEST_STATUS_LABELS[status]}.` };
}
