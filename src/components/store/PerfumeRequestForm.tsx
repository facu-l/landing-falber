"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPerfumeRequest } from "@/app/(store)/encargos/actions";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { RequestPrefill } from "@/lib/requests/prefill";
import { INITIAL_REQUEST_STATE, type RequestState } from "@/lib/requests/state";
import { FormSection } from "./FormSection";
import { TurnstileField } from "./TurnstileField";

/**
 * "¿No encontrás tu perfume?" (/encargos).
 * - Sin producto: perfume, marca y presentación escritos a mano.
 * - Con producto (?producto=<slug>): perfume y marca de solo lectura (si se pudieran
 *   editar, el encargo podría no coincidir con la variante) y la presentación se elige
 *   entre las agotadas; su id va como variantId.
 * - El botón se deshabilita mientras la acción corre (doble click).
 * - Al terminar, la confirmación reemplaza al formulario en la misma página.
 */
export function PerfumeRequestForm({ prefill }: { prefill: RequestPrefill | null }) {
  const variants = prefill?.variants ?? [];
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const [state, formAction, pending] = useActionState(async (prev: RequestState, formData: FormData) => {
    const next = await createPerfumeRequest(prev, formData);
    // El token ya se usó (o era inválido): Turnstile tiene que dar uno nuevo.
    if (next.status === "error") setTurnstileResetKey((key) => key + 1);
    return next;
  }, INITIAL_REQUEST_STATE);

  if (state.status === "success") return <Confirmation perfumeName={state.perfumeName} />;

  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? state.values : {};
  const selected = variants.find((v) => v.id === variantId) ?? variants[0];

  return (
    <form action={formAction} noValidate className="flex max-w-2xl flex-col gap-10">
      <FormSection title="El perfume">
        <Input
          label="Perfume"
          name="perfumeName"
          maxLength={120}
          readOnly={!!prefill}
          defaultValue={prefill?.perfumeName ?? values.perfumeName}
          error={errors.perfumeName}
        />
        <Input
          label="Marca"
          name="brand"
          maxLength={60}
          readOnly={!!prefill}
          hint={prefill ? undefined : "Opcional."}
          defaultValue={prefill?.brand ?? values.brand}
          error={errors.brand}
        />
        {selected ? (
          <>
            {/*
              Después de la acción React resetea el <form>, y un <select> vuelve a la opción
              con defaultSelected. React marca defaultSelected solo al montar el select
              (a un <input> sí le actualiza el defaultValue), así que sin remontarlo volvería
              a la primera opción. El key lo remonta con lo que se mandó.
            */}
            <Select
              key={values.variantId ?? "initial"}
              label="Presentación"
              name="variantId"
              defaultValue={values.variantId || selected.id}
              onChange={(event) => setVariantId(event.target.value)}
              error={errors.variantId}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
            <input type="hidden" name="presentation" value={selected.label} />
          </>
        ) : (
          <Input
            label="Presentación"
            name="presentation"
            maxLength={60}
            hint="Opcional. Ej.: decant de 10 ml o frasco de 100 ml."
            defaultValue={values.presentation}
            error={errors.presentation}
          />
        )}
        {prefill && (
          <Link
            href="/encargos"
            className="self-start text-caption text-text-secondary uppercase underline underline-offset-4"
          >
            Encargar otro perfume
          </Link>
        )}
      </FormSection>

      <FormSection title="Tus datos">
        <Input
          label="Nombre y apellido"
          name="fullName"
          autoComplete="name"
          maxLength={80}
          defaultValue={values.fullName}
          error={errors.fullName}
        />
        <Input
          label="WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="Con código de área. Ej.: 221 555 1234"
          defaultValue={values.whatsapp}
          error={errors.whatsapp}
        />
        <Input
          label="Aclaración"
          name="note"
          maxLength={100}
          hint="Opcional. Hasta 100 caracteres."
          defaultValue={values.note}
          error={errors.note}
        />
      </FormSection>

      <div className="flex flex-col items-start gap-4 border-t border-border pt-8">
        <p className="text-caption text-text-muted">
          Usamos tus datos solo para gestionar este encargo y contactarte por WhatsApp (Ley 25.326).
        </p>
        {state.status === "error" && state.message && (
          <p role="alert" className="text-body-sm text-error">
            {state.message}
          </p>
        )}
        <TurnstileField resetKey={turnstileResetKey} />
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending ? "Enviando encargo" : "Enviar encargo"}
        </Button>
      </div>
    </form>
  );
}

function Confirmation({ perfumeName }: { perfumeName: string }) {
  return (
    <div role="status" className="flex max-w-2xl flex-col items-start gap-6 border-t border-border pt-8">
      <h2 className="text-label text-text-secondary uppercase">Encargo recibido</h2>
      <p className="text-body text-text">
        Registramos tu pedido de {perfumeName}. Te escribimos por WhatsApp para contarte disponibilidad y precio.
      </p>
      <Link href="/catalogo" className={buttonClasses("secondary")}>
        Volver al catálogo
      </Link>
    </div>
  );
}
