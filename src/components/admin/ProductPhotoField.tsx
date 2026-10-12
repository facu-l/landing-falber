"use client";

import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { requestPhotoUpload, savePhoto } from "@/app/admin/(panel)/productos/[id]/actions";
import { ProductImage } from "@/components/store/ProductImage";
import { Button, buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { preparePhoto, uploadToSignedUrl } from "@/lib/admin/photo-image";
import { PHOTO_ERRORS } from "@/lib/admin/product-photo";

type Step =
  | { kind: "idle" }
  | { kind: "preparing" }
  /** previewUrl: object URL de la foto preparada, para verla mientras sube. */
  | { kind: "uploading"; previewUrl: string }
  | { kind: "saved" }
  /** blob: la foto ya preparada, para Reintentar sin volver a elegirla. */
  | { kind: "error"; message: string; blob?: Blob };

type Props = { productId: string; imagePath: string | null; alt: string };

/**
 * Foto del producto (decisiones 96 y 97, D13, D15). La vista previa es la de la tienda:
 * ProductImage dentro de data-theme="dark" (Noir), aunque el panel sea Platinum.
 * Si algo falla, la foto anterior sigue a la vista y Reintentar usa el mismo archivo.
 */
export function ProductPhotoField({ productId, imagePath, alt }: Props) {
  const inputId = useId();
  // El contenedor Noir de la vista previa: de ahí sale el fondo de la foto en la tienda.
  const noirRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const busy = step.kind === "preparing" || step.kind === "uploading";

  // La vista previa local se libera cuando termina la subida (o al desmontar).
  const localUrl = step.kind === "uploading" ? step.previewUrl : null;
  useEffect(() => (localUrl ? () => URL.revokeObjectURL(localUrl) : undefined), [localUrl]);

  async function upload(blob: Blob) {
    setStep({ kind: "uploading", previewUrl: URL.createObjectURL(blob) });
    try {
      const target = await requestPhotoUpload(productId, blob.type);
      if (!target.ok) return setStep({ kind: "error", message: target.message, blob });

      if (!(await uploadToSignedUrl(target.signedUrl, blob))) {
        return setStep({ kind: "error", message: PHOTO_ERRORS.upload, blob });
      }

      const saved = await savePhoto(productId, target.path);
      // savePhoto refresca la página: imagePath llega con la foto nueva.
      setStep(saved.ok ? { kind: "saved" } : { kind: "error", message: saved.message, blob });
    } catch {
      // Una Server Action que no llega (red caída, deploy en curso) rechaza la promesa: sin
      // esto, el campo quedaba en "Subiendo foto" sin error ni Reintentar.
      setStep({ kind: "error", message: PHOTO_ERRORS.upload, blob });
    }
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Vacía el input: elegir el mismo archivo otra vez tiene que volver a disparar onChange.
    event.target.value = "";
    if (!file) return;

    setStep({ kind: "preparing" });
    // surface-raised de Noir: el fondo de ProductImage en la tienda (sin hex en el código).
    const background = noirRef.current ? getComputedStyle(noirRef.current).getPropertyValue("--surface-raised").trim() : "";
    let prepared: Awaited<ReturnType<typeof preparePhoto>>;
    try {
      prepared = await preparePhoto(file, background);
    } catch {
      prepared = { ok: false, message: PHOTO_ERRORS.unreadable };
    }
    if (!prepared.ok) return setStep({ kind: "error", message: prepared.message });
    await upload(prepared.blob);
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div ref={noirRef} data-theme="dark" className="w-60 shrink-0 bg-surface p-3">
        {localUrl ? (
          <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-surface-raised">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: local, next/image no lo optimiza */}
            <img src={localUrl} alt="" className="h-full w-full object-cover opacity-60" />
          </div>
        ) : (
          <ProductImage imagePath={imagePath} alt={alt} sizes="240px" />
        )}
      </div>

      <div className="flex flex-col items-start gap-4">
        <StepMessage step={step} hasPhoto={Boolean(imagePath)} />
        <div className="flex flex-wrap gap-3">
          <input
            id={inputId}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={onChange}
            className="peer sr-only"
          />
          <label
            htmlFor={inputId}
            aria-disabled={busy || undefined}
            className={cn(
              buttonClasses("secondary"),
              // El input es sr-only: el anillo de foco del teclado se dibuja en el label.
              "cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              busy && "pointer-events-none opacity-50",
            )}
          >
            {imagePath ? "Cambiar foto" : "Elegir foto"}
          </label>
          {step.kind === "error" && step.blob && (
            <Button onClick={() => upload(step.blob!)}>Reintentar</Button>
          )}
        </div>
        <p className="text-body-sm text-text-muted">
          Se achica sola antes de subir. Va a la tienda con el mismo recorte que ves acá.
        </p>
      </div>
    </div>
  );
}

function StepMessage({ step, hasPhoto }: { step: Step; hasPhoto: boolean }) {
  switch (step.kind) {
    case "preparing":
      return <p role="status" className="text-body text-text-secondary">Preparando foto</p>;
    case "uploading":
      return <p role="status" className="text-body text-text-secondary">Subiendo foto</p>;
    case "saved":
      return <p role="status" className="text-body text-text-secondary">Foto guardada.</p>;
    case "error":
      return (
        <p role="alert" className="text-body text-error">
          {step.message}
        </p>
      );
    default:
      // role="status" desde el arranque: React reusa este mismo <p> en cada paso, así que
      // "Preparando foto" llega como cambio dentro de una región viva que ya existía (se anuncia).
      return (
        <p role="status" className="text-body text-text-secondary">
          {hasPhoto ? "Esta es la foto de la tienda." : "Sin foto."}
        </p>
      );
  }
}
