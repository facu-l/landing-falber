"use client";

import { useActionState, useRef } from "react";
import { updateProductData } from "@/app/admin/(panel)/productos/[id]/actions";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { AdminProductRow } from "@/lib/admin/product-list";
import { INITIAL_PRODUCT_DATA_STATE } from "@/lib/admin/product-data";
import { GENDER_LABELS } from "@/lib/catalog/catalog";
import { useFocusFirstInvalid } from "@/lib/forms/focus-first-invalid";
import { LIMITS } from "@/lib/forms/limits";

type Props = {
  product: Pick<AdminProductRow, "id" | "slug" | "brand" | "name" | "gender" | "description" | "is_featured">;
};

/** Sección Datos de la ficha (D12): lo que ve el cliente del perfume, sin la foto ni las presentaciones. */
export function ProductDataForm({ product }: Props) {
  const [state, formAction, pending] = useActionState(
    updateProductData.bind(null, product.id),
    INITIAL_PRODUCT_DATA_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  useFocusFirstInvalid(formRef, fieldErrors);

  // Después de un error, lo escrito (React resetea el form); si no, lo guardado.
  const values =
    state.status === "error"
      ? state.values
      : {
          brand: product.brand,
          name: product.name,
          gender: product.gender ?? "",
          description: product.description ?? "",
          featured: product.is_featured ? "on" : "",
        };

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-6">
      <Input
        label="Marca"
        name="brand"
        autoComplete="off"
        maxLength={LIMITS.brand}
        defaultValue={values.brand}
        error={fieldErrors?.brand}
      />
      <Input
        label="Nombre"
        name="name"
        autoComplete="off"
        maxLength={LIMITS.perfumeName}
        hint={`El link no cambia: /producto/${product.slug}`}
        defaultValue={values.name}
        error={fieldErrors?.name}
      />
      <Select label="Género" name="gender" defaultValue={values.gender} error={fieldErrors?.gender}>
        <option value="">Sin género</option>
        {Object.entries(GENDER_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Textarea label="Descripción" name="description" defaultValue={values.description} />
      <Checkbox
        label="Destacado"
        name="featured"
        defaultChecked={values.featured === "on"}
        hint="La home muestra hasta 3 destacados con stock."
      />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando" : "Guardar datos"}
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
