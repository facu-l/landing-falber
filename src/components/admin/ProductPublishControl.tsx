"use client";

import { useActionState, useState } from "react";
import { updateProductStatus } from "@/app/admin/(panel)/productos/[id]/actions";
import { Button, buttonClasses } from "@/components/ui/Button";
import type { ProductStatus } from "@/lib/admin/product-list";
import { HIDE_WARNING, INITIAL_PUBLISH_STATE, type PublishState } from "@/lib/admin/product-publish";

type Props = {
  product: { id: string; slug: string; status: ProductStatus };
  /** "Para publicar falta: …" (missingForPublishText), o null si no falta nada. */
  missing?: string | null;
  /** id de esa lista en la página: Publicar la anuncia (D17). */
  missingId?: string;
};

/**
 * Publicar u Ocultar en el encabezado de la ficha (D9). Publicar es primario y la base
 * dice si falta algo. Ocultar es secundario y pide confirmar: saca el perfume de la
 * tienda en el momento. La acción refresca y el producto llega con su estado nuevo.
 */
export function ProductPublishControl({ product, missing = null, missingId }: Props) {
  const [state, formAction, pending] = useActionState(updateProductStatus.bind(null, product.id), INITIAL_PUBLISH_STATE);
  const [confirming, setConfirming] = useState(false);

  // Con cada respuesta se cierra la confirmación (en el render que trae el estado nuevo).
  const [lastState, setLastState] = useState<PublishState>(state);
  if (state !== lastState) {
    setLastState(state);
    setConfirming(false);
  }

  // Si cambió lo que falta (se cargó la foto o una presentación en otra sección), la última
  // respuesta ya no es cierta ("falta una presentación"): se deja de mostrar.
  const [lastMissing, setLastMissing] = useState(missing);
  const [staleState, setStaleState] = useState<PublishState | null>(null);
  if (missing !== lastMissing) {
    setLastMissing(missing);
    setStaleState(state);
  }
  const shown = state === staleState ? INITIAL_PUBLISH_STATE : state;

  const published = product.status === "active";

  return (
    <div className="flex flex-col items-start gap-4">
      {!published && (
        <form action={formAction}>
          <input type="hidden" name="status" value="active" />
          <Button type="submit" disabled={pending} aria-describedby={missing ? missingId : undefined}>
            {pending ? "Publicando" : "Publicar"}
          </Button>
        </form>
      )}
      {published && !confirming && (
        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/producto/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("secondary")}
          >
            Ver en la tienda<span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Ocultar
          </Button>
        </div>
      )}
      {published && confirming && (
        <form action={formAction} className="flex flex-col items-start gap-4 border-l-2 border-accent pl-4">
          <input type="hidden" name="status" value="inactive" />
          <p className="text-body-sm text-text">{HIDE_WARNING}</p>
          <div className="flex flex-wrap gap-4">
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Ocultando" : "Sí, ocultar"}
            </Button>
            {/* El foco va a la opción que no cambia nada: un Enter de más no oculta. */}
            <Button autoFocus onClick={() => setConfirming(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
      {shown.status === "error" && (
        <p role="alert" className="text-body-sm text-error">
          {shown.message}
        </p>
      )}
      {shown.status === "success" && (
        <p role="status" className="text-body-sm text-text-secondary">
          {shown.message}
        </p>
      )}
    </div>
  );
}
