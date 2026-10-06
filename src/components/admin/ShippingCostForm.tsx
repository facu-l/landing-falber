"use client";

import { useActionState } from "react";
import { setShippingCost } from "@/app/admin/(panel)/pedidos/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INITIAL_ORDER_ACTION_STATE } from "@/lib/admin/order-action-state";

type Props = { orderId: string; shippingCost: number | null };

/**
 * Costo de envío de un pedido con envío. Se muestra solo mientras se puede cambiar
 * (canSetShippingCost); la base lo vuelve a validar. Vacío = a coordinar.
 */
export function ShippingCostForm({ orderId, shippingCost }: Props) {
  const [state, formAction, pending] = useActionState(setShippingCost, INITIAL_ORDER_ACTION_STATE);
  // Después de un error, lo escrito (React resetea el form); si no, el costo guardado.
  const value = state.status === "error" ? state.values?.shippingCost : (shippingCost?.toString() ?? "");

  return (
    <form action={formAction} className="flex flex-col items-start gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <Input
        label="Costo de envío"
        name="shippingCost"
        inputMode="numeric"
        autoComplete="off"
        hint="En pesos, sin centavos. Vacío: a coordinar."
        defaultValue={value}
        error={state.status === "error" ? state.message : undefined}
        className="w-full max-w-sm"
      />
      {state.status === "success" && (
        <p role="status" className="text-body-sm text-text-secondary">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando" : "Guardar costo"}
      </Button>
    </form>
  );
}
