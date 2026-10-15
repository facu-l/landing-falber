"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addVariant } from "@/app/admin/(panel)/productos/[id]/variant-actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RadioGroup, RadioOption } from "@/components/ui/Radio";
import { Select } from "@/components/ui/Select";
import type { VariantType } from "@/lib/catalog/catalog";
import {
  decantOptions,
  type ExistingVariant,
  INITIAL_VARIANT_FORM_STATE,
  nextFreeDecantSize,
  type VariantFormState,
} from "@/lib/admin/product-variants";
import { useFocusFirstInvalid } from "@/lib/forms/focus-first-invalid";

type Props = { productId: string; existing: readonly ExistingVariant[] };

/**
 * Agregar presentación (D8, D10). Queda abierto después de guardar: preselecciona el
 * próximo decant libre (llega con las presentaciones nuevas del refresh) y el foco
 * vuelve a Precio para cargar la siguiente.
 */
export function AddVariantForm({ productId, existing }: Props) {
  const [state, formAction, pending] = useActionState(addVariant.bind(null, productId), INITIAL_VARIANT_FORM_STATE);

  const nextDecant = nextFreeDecantSize(existing);
  const [type, setType] = useState<VariantType>(nextDecant === null ? "full_bottle" : "decant");
  // Con los tres decants cargados (otra pestaña, o este mismo form), pasa a Frasco.
  const effectiveType: VariantType = type === "decant" && nextDecant === null ? "full_bottle" : type;

  // Cuenta las respuestas y toma el tipo de lo escrito, en el render que trae el estado nuevo
  // (como ProductDataForm): la key remonta los campos que React resetea con el form.
  const [lastState, setLastState] = useState<VariantFormState>(state);
  const [responses, setResponses] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    setResponses(responses + 1);
    if (state.status === "error" && (state.values.variantType === "decant" || state.values.variantType === "full_bottle")) {
      setType(state.values.variantType);
    }
  }

  const formRef = useRef<HTMLFormElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  useFocusFirstInvalid(formRef, fieldErrors);
  useEffect(() => {
    if (state.status === "success" || state.status === "partial") priceRef.current?.focus();
  }, [state]);

  // Después de un error, lo escrito; si no, vacío (el tamaño, el próximo libre).
  const values = state.status === "error" ? state.values : {};

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-6">
      <RadioGroup key={`type-${responses}`} legend="Tipo de presentación" error={fieldErrors?.variantType}>
        <RadioOption
          name="variantType"
          value="decant"
          checked={effectiveType === "decant"}
          onChange={() => setType("decant")}
          disabled={nextDecant === null}
          label="Decant"
          detail={nextDecant === null ? "Ya están los de 3, 5 y 10 ml." : "3, 5 o 10 ml."}
        />
        <RadioOption
          name="variantType"
          value="full_bottle"
          checked={effectiveType === "full_bottle"}
          onChange={() => setType("full_bottle")}
          label="Frasco"
          detail="Los ml del frasco, a mano."
        />
      </RadioGroup>
      {effectiveType === "decant" ? (
        <Select
          key={`decant-${responses}`}
          label="Tamaño"
          name="sizeMl"
          defaultValue={values.sizeMl ?? String(nextDecant ?? "")}
          error={fieldErrors?.sizeMl}
        >
          {decantOptions(existing).map((option) => (
            <option key={option.sizeMl} value={option.sizeMl} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          key={`bottle-${responses}`}
          label="ml del frasco"
          name="sizeMl"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={values.sizeMl}
          error={fieldErrors?.sizeMl}
        />
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Input
          key={`price-${responses}`}
          ref={priceRef}
          label="Precio"
          name="price"
          inputMode="numeric"
          autoComplete="off"
          hint="En pesos, sin centavos."
          defaultValue={values.price}
          error={fieldErrors?.price}
        />
        <Input
          key={`stock-${responses}`}
          label="Stock inicial"
          name="initialStock"
          inputMode="numeric"
          autoComplete="off"
          hint="Opcional. Las unidades que tenés ahora."
          defaultValue={values.initialStock}
          error={fieldErrors?.initialStock}
        />
      </div>
      <p className="text-body-sm text-text-secondary">El tipo y los ml no se cambian después.</p>
      {((state.status === "error" && state.message) || state.status === "partial") && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Agregando" : "Agregar presentación"}
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
