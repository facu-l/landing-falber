import { type DbError, mapDbError } from "@/lib/db-errors";
import type { ProductStatus } from "./product-list";

/*
 * Publicar y ocultar un producto (D9). La base decide qué se puede publicar
 * (guard_product_publish en 0003: foto y una presentación disponible) y avisa qué
 * falta con PRODUCT_NOT_PUBLISHABLE y detail = 'image' | 'variant'. Puras: se prueban sin base.
 */

export const PUBLISH_ERRORS = {
  image: "Para publicar falta la foto.",
  variant: "Para publicar falta una presentación disponible.",
  notPublishable: "Todavía no se puede publicar. Revisá la foto y las presentaciones.",
  save: "No pudimos guardar el cambio. Probá de nuevo en unos segundos.",
  notSaved: "No pudimos guardar el cambio. Recargá la página y probá de nuevo.",
} as const;

export const HIDE_WARNING =
  "Ocultar saca el perfume de la tienda ahora. Quien lo tenga en el carrito no va a poder comprarlo.";

const TARGET_STATUSES: readonly ProductStatus[] = ["active", "inactive"];

/** El estado que pide el botón. null = cualquier otra cosa: la acción no escribe. */
export function parseTargetStatus(value: string | undefined): ProductStatus | null {
  return (TARGET_STATUSES as readonly string[]).includes(value ?? "") ? (value as ProductStatus) : null;
}

const NOT_PUBLISHABLE = { PRODUCT_NOT_PUBLISHABLE: PUBLISH_ERRORS.notPublishable } as const;

/** El error de la base → el mensaje del panel. known: false = no es nuestro, hay que loguearlo. */
export function publishErrorMessage(error: DbError): { known: boolean; message: string } {
  const mapped = mapDbError(error, NOT_PUBLISHABLE, PUBLISH_ERRORS.save);
  if (!mapped.known) return { known: false, message: mapped.message };
  if (mapped.detail === "image") return { known: true, message: PUBLISH_ERRORS.image };
  if (mapped.detail === "variant") return { known: true, message: PUBLISH_ERRORS.variant };
  return { known: true, message: mapped.message };
}

/** Estado de Publicar u Ocultar (useActionState). Fuera de las acciones: un archivo "use server" solo exporta funciones async. */
export type PublishState =
  | { status: "idle" }
  | { status: "success"; published: boolean; message: string }
  | { status: "error"; message: string };

export const INITIAL_PUBLISH_STATE: PublishState = { status: "idle" };
