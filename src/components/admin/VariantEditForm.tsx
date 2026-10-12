"use client";

import { useActionState, useRef, useState } from "react";
import { updateVariant } from "@/app/admin/(panel)/productos/[id]/variant-actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { INITIAL_VARIANT_FORM_STATE, type VariantFormState } from "@/lib/admin/product-variants";
import { useFocusFirstInvalid } from "@/lib/forms/focus-first-invalid";

type Props = {
  variant: { id: string; price: number; is_available: boolean };
  onClose: () => void;
};

/** Editar de una presentación (D8): precio y Disponible. Tipo y ml no se cambian (0003). */
export function VariantEditForm({ variant, onClose }: Props) {
  const [state, formAction, pending] = useActionState(updateVariant.bind(null, variant.id), INITIAL_VARIANT_FORM_STATE);

  // Mismo patrón que ProductDataForm: la key remonta el checkbox que React resetea con el form.
  const [lastState, setLastState] = useState<VariantFormState>(state);
  const [responses, setResponses] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setResponses(responses + 1);
  }
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  useFocusFirstInvalid(formRef, fieldErrors);

  const values =
    state.status === "error"
      ? state.values
      : { price: String(variant.price), isAvailable: variant.is_available ? "on" : "" };

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-6 border-l-2 border-accent pl-4">
      <Input
        label="Precio"
        name="price"
        inputMode="numeric"
        autoComplete="off"
        hint="En pesos, sin centavos."
        defaultValue={values.price}
        error={fieldErrors?.price}
        autoFocus
      />
      <Checkbox
        key={`available-${responses}`}
        label="Disponible"
        name="isAvailable"
        defaultChecked={values.isAvailable === "on"}
        hint="Sin tildar, la tienda no la ofrece. El stock y el historial quedan."
      />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando" : "Guardar"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {state.status === "success" ? "Cerrar" : "Cancelar"}
        </Button>
        {state.status === "success" && (
          <p role="status" className="text-body-sm text-text-secondary">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
