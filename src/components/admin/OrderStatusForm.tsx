"use client";

import { useActionState, useState } from "react";
import { updateOrderStatus } from "@/app/admin/(panel)/pedidos/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { INITIAL_ORDER_ACTION_STATE, type OrderActionState } from "@/lib/admin/order-action-state";
import { nextOrderStatuses, type OrderForTransition } from "@/lib/admin/order-transitions";
import { ORDER_STATUS_LABELS } from "@/lib/orders/summary";

type Props = { order: OrderForTransition & { id: string } };

/**
 * Cambio de estado. Ofrece solo las transiciones válidas (copia de la base); la base
 * vuelve a validar. Después de un cambio, la acción refresca la página y llega el
 * pedido con su estado nuevo, y con él las opciones nuevas.
 */
export function OrderStatusForm({ order }: Props) {
  const options = nextOrderStatuses(order);
  const [selected, setSelected] = useState(options[0]);
  const [responses, setResponses] = useState(0);

  const [state, formAction, pending] = useActionState(async (prev: OrderActionState, formData: FormData) => {
    const next = await updateOrderStatus(prev, formData);
    setResponses((count) => count + 1);
    return next;
  }, INITIAL_ORDER_ACTION_STATE);

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {/* Recién cerrado desde acá (ej. cancelado): la confirmación sigue a la vista. */}
        {state.status === "success" && (
          <p role="status" className="text-body-sm text-text-secondary">
            {state.message}
          </p>
        )}
        <p className="text-body text-text-secondary">Este pedido está cerrado.</p>
      </div>
    );
  }

  // Si el estado cambió (refresh), la elección anterior puede no ser válida: vuelve a la primera.
  const current = selected && options.includes(selected) ? selected : options[0];
  const cancelling = current === "cancelled";

  return (
    <form action={formAction} className="flex flex-col items-start gap-4">
      <input type="hidden" name="orderId" value={order.id} />
      {/*
        key: React resetea el <form> después de la acción y el <select> volvería a la opción
        que tenía al montarse (decisión 48). Remontarlo en cada respuesta y en cada estado
        nuevo lo deja en la elección actual.
      */}
      <Select
        key={`${order.status}-${responses}`}
        label="Nuevo estado"
        name="status"
        defaultValue={current}
        onChange={(event) => setSelected(event.target.value as typeof current)}
        className="w-full max-w-sm"
      >
        {options.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>
      {cancelling && (
        <p className="text-body-sm text-text-secondary">Cancelar devuelve el stock y no se puede deshacer.</p>
      )}
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
      <Button type="submit" variant={cancelling ? "secondary" : "primary"} disabled={pending}>
        {pending ? "Guardando" : cancelling ? "Cancelar pedido" : "Cambiar estado"}
      </Button>
    </form>
  );
}
