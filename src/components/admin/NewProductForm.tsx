"use client";

import { useActionState, useRef, useState } from "react";
import { createProduct } from "@/app/admin/(panel)/productos/actions";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INITIAL_NEW_PRODUCT_STATE, slugify } from "@/lib/admin/product-list";
import { useFocusFirstInvalid } from "@/lib/forms/focus-first-invalid";
import { LIMITS } from "@/lib/forms/limits";

/**
 * Alta corta detrás de NUEVO PRODUCTO: marca y nombre, con el link a la vista.
 * Abierta de entrada solo si todavía no hay productos. Si sale bien, la acción lleva
 * a la ficha del producto; acá solo vuelven errores.
 */
export function NewProductForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [state, formAction, pending] = useActionState(createProduct, INITIAL_NEW_PRODUCT_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  useFocusFirstInvalid(formRef, fieldErrors);

  // Controlados: el link se arma mientras se escribe, y lo escrito sobrevive al reset del form.
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const slug = slugify(brand, name);

  return (
    <details open={defaultOpen || undefined} className="group flex flex-col">
      {/* Abierto se ve como el hover: avisa que el mismo botón lo cierra (sin marcador nativo). */}
      <summary
        className={buttonClasses(
          "secondary",
          "cursor-pointer self-start list-none group-open:border-accent group-open:text-accent-strong [&::-webkit-details-marker]:hidden",
        )}
      >
        Nuevo producto
      </summary>
      <form ref={formRef} action={formAction} noValidate className="mt-6 flex max-w-xl flex-col gap-6">
        <Input
          label="Marca"
          name="brand"
          autoComplete="off"
          maxLength={LIMITS.brand}
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          error={fieldErrors?.brand}
        />
        <Input
          label="Nombre"
          name="name"
          autoComplete="off"
          maxLength={LIMITS.perfumeName}
          hint="Como se ve en la tienda, con la concentración si hace falta (ej. Sauvage EDT)."
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldErrors?.name}
        />
        {/* Sin name: el servidor arma el slug de nuevo, este es solo la vista previa. */}
        <Input
          label="Link"
          readOnly
          tabIndex={-1}
          value={slug ? `/producto/${slug}` : ""}
          placeholder="Se arma con la marca y el nombre"
          hint="El link queda fijo: no cambia aunque después corrijas el nombre."
        />
        {state.status === "error" && state.message && (
          <p role="alert" className="text-body-sm text-error">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Creando" : "Crear producto"}
        </Button>
      </form>
    </details>
  );
}
