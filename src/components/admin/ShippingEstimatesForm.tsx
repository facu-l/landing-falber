"use client";

import { useActionState } from "react";
import { updateShippingEstimates } from "@/app/admin/(panel)/envios/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INITIAL_SHIPPING_ESTIMATES_STATE } from "@/lib/admin/shipping-estimates";
import type { ShippingRates } from "@/lib/shipping/rates";

/**
 * Los envíos estimados que el checkout muestra debajo de "Envío a domicilio".
 * Son informativos: el costo real de cada pedido se sigue cargando en su detalle.
 */
export function ShippingEstimatesForm({ estimates }: { estimates: ShippingRates }) {
  const [state, formAction, pending] = useActionState(updateShippingEstimates, INITIAL_SHIPPING_ESTIMATES_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  // Después de un error, lo escrito (React resetea el form); si no, lo guardado.
  const values =
    state.status === "error"
      ? state.values
      : { toBranch: estimates.toBranch.toString(), toHome: estimates.toHome.toString() };

  return (
    <form action={formAction} noValidate className="flex max-w-sm flex-col gap-6">
      <Input
        label="Envío estimado a sucursal"
        name="toBranch"
        inputMode="numeric"
        autoComplete="off"
        hint="En pesos, sin centavos. 0: envío gratis."
        defaultValue={values.toBranch}
        error={errors.toBranch}
      />
      <Input
        label="Envío estimado a domicilio"
        name="toHome"
        inputMode="numeric"
        autoComplete="off"
        hint="En pesos, sin centavos. 0: envío gratis."
        defaultValue={values.toHome}
        error={errors.toHome}
      />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-body-sm text-text-secondary">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando" : "Guardar"}
      </Button>
    </form>
  );
}
