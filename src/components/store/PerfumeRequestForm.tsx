"use client";

import Link from "next/link";
import { startTransition, useActionState, useLayoutEffect, useRef, useState } from "react";
import { createPerfumeRequest } from "@/app/(store)/encargos/actions";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LIMITS } from "@/lib/forms/limits";
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
 * - Con Cache Components, Next esconde la página al salir (<Activity>) en vez de
 *   desmontarla: sin el reset de abajo, volver por un link mostraría la confirmación vieja.
 */
const RESET = "reset";

export function PerfumeRequestForm({ prefill }: { prefill: RequestPrefill | null }) {
  const variants = prefill?.variants ?? [];
  // String y no el array: sin prefill, `variants` es un [] nuevo en cada render y el
  // layout effect de abajo correría (y resetearía) en cada render.
  const firstVariantId = variants[0]?.id ?? "";
  const [variantId, setVariantId] = useState(firstVariantId);
  const [serverErrors, setServerErrors] = useState(0);
  const resetWhenHidden = useRef(false);

  const [state, formAction, pending] = useActionState(
    async (prev: RequestState, input: FormData | typeof RESET) => {
      if (input === RESET) return INITIAL_REQUEST_STATE;
      const next = await createPerfumeRequest(prev, input);
      // El token ya se usó (o era inválido): Turnstile tiene que dar uno nuevo.
      if (next.status === "error") setServerErrors((key) => key + 1);
      if (next.status === "success") resetWhenHidden.current = true;
      return next;
    },
    INITIAL_REQUEST_STATE,
  );

  /*
   * Patrón de la guía de Next (preserving-ui-state.md): la limpieza de un layout effect
   * corre cuando Activity esconde la página. Solo se resetea después de un encargo
   * enviado: un borrador a medio escribir se conserva al ir y volver.
   */
  useLayoutEffect(() => {
    return () => {
      if (!resetWhenHidden.current) return;
      resetWhenHidden.current = false;
      setVariantId(firstVariantId);
      startTransition(() => formAction(RESET));
    };
  }, [formAction, firstVariantId]);

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
          maxLength={LIMITS.perfumeName}
          readOnly={!!prefill}
          defaultValue={prefill?.perfumeName ?? values.perfumeName}
          error={errors.perfumeName}
        />
        <Input
          label="Marca"
          name="brand"
          maxLength={LIMITS.brand}
          readOnly={!!prefill}
          hint={prefill ? undefined : "Opcional."}
          defaultValue={prefill?.brand ?? values.brand}
          error={errors.brand}
        />
        {selected ? (
          <>
            {/*
              Después de la acción React resetea el <form>, y un <select> vuelve a la opción
              con defaultSelected. React la marca solo al montar el select (a un <input> sí
              le actualiza el defaultValue). key = cantidad de errores: cada respuesta lo
              remonta con la elección actual, aunque haya cambiado mientras se enviaba.
            */}
            <Select
              key={serverErrors}
              label="Presentación"
              name="variantId"
              defaultValue={selected.id}
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
            maxLength={LIMITS.presentation}
            hint="Opcional. Ej.: decant de 10 ml o frasco de 100 ml."
            defaultValue={values.presentation}
            error={errors.presentation}
          />
        )}
        {prefill && (
          <Link
            href="/encargos"
            className="self-start text-caption text-text-secondary uppercase underline underline-offset-4 transition-colors duration-150 hover:text-text"
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
          maxLength={LIMITS.fullName}
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
          maxLength={LIMITS.note}
          hint={`Opcional. Hasta ${LIMITS.note} caracteres.`}
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
        <TurnstileField resetKey={serverErrors} />
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
        Registramos tu encargo de {perfumeName}. Te escribimos por WhatsApp para contarte disponibilidad y precio.
      </p>
      <Link href="/catalogo" className={buttonClasses("secondary")}>
        Volver al catálogo
      </Link>
    </div>
  );
}
