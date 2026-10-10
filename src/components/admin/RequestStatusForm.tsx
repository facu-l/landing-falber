"use client";

import { useActionState, useState } from "react";
import { updateRequestStatus } from "@/app/admin/(panel)/encargos/actions";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { INITIAL_REQUEST_ACTION_STATE, type RequestActionState } from "@/lib/admin/request-action";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  type RequestStatus,
  nextRequestStatuses,
} from "@/lib/admin/request-list";

type Props = { request: { id: string; status: RequestStatus } };

/** El siguiente del flujo (pendiente → contactado → ...); desde el último, el primero que queda. */
function suggestedStatus(current: RequestStatus, options: RequestStatus[]): RequestStatus {
  return REQUEST_STATUSES[REQUEST_STATUSES.indexOf(current) + 1] ?? options[0];
}

/**
 * Cambio de estado de un encargo, en su fila de la lista. Mismo patrón que
 * OrderStatusForm: después del cambio, la acción refresca y la fila llega con el
 * estado nuevo (y con él, las opciones nuevas).
 */
export function RequestStatusForm({ request }: Props) {
  const options = nextRequestStatuses(request.status);
  const [selected, setSelected] = useState<RequestStatus>(() => suggestedStatus(request.status, options));
  const [responses, setResponses] = useState(0);

  const [state, formAction, pending] = useActionState(async (prev: RequestActionState, formData: FormData) => {
    const next = await updateRequestStatus(prev, formData);
    setResponses((count) => count + 1);
    return next;
  }, INITIAL_REQUEST_ACTION_STATE);

  // Si el estado cambió (refresh), la elección anterior puede no ser válida.
  const current = options.includes(selected) ? selected : suggestedStatus(request.status, options);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={request.id} />
      {/* Compare-and-set: la acción solo escribe si el encargo sigue en el estado que se ve acá. */}
      <input type="hidden" name="fromStatus" value={request.status} />
      <div className="flex items-end gap-3">
        {/* key: React resetea el <form> después de la acción (decisión 48, igual que en pedidos). */}
        <Select
          key={`${request.status}-${responses}`}
          label="Estado del encargo"
          name="status"
          defaultValue={current}
          onChange={(event) => setSelected(event.target.value as RequestStatus)}
          className="w-full md:w-52"
        >
          {options.map((status) => (
            <option key={status} value={status}>
              {REQUEST_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Guardando" : "Cambiar"}
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-body-sm text-text-secondary">
          {state.message}
        </p>
      )}
    </form>
  );
}
