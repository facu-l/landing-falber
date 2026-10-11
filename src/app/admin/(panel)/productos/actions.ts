"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/lib/admin/auth";
import { adminProductPath } from "@/lib/admin/paths";
import {
  isDuplicateSlugError,
  NEW_PRODUCT_ERRORS,
  NEW_PRODUCT_SAVE_ERROR,
  type NewProductState,
  parseNewProduct,
} from "@/lib/admin/product-list";
import { loggableDbError } from "@/lib/db-errors";
import { formValues } from "@/lib/forms/form-data";

/**
 * Alta corta: marca y nombre. El slug lo arma el servidor (el del navegador es solo la
 * vista previa) y la base lo deja fijo (SLUG_LOCKED). Nace sin publicar por el default
 * de 0003: no se manda status. Todavía no está en la tienda, así que no vence el caché
 * del catálogo. Después va a su ficha a cargar foto y presentaciones.
 */
export async function createProduct(_prev: NewProductState, formData: FormData): Promise<NewProductState> {
  const access = await requireAdminAction();

  const raw = formValues(formData);
  const values = { brand: raw.brand ?? "", name: raw.name ?? "" };
  if (!access.ok) return { status: "error", message: access.message, values };

  const parsed = parseNewProduct(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const { data, error } = await access.supabase.from("products").insert(parsed.data).select("id").single();

  if (error) {
    if (isDuplicateSlugError(error)) {
      return { status: "error", fieldErrors: { name: NEW_PRODUCT_ERRORS.duplicateSlug }, values };
    }
    console.error("[admin] crear un producto falló", loggableDbError(error));
    return { status: "error", message: NEW_PRODUCT_SAVE_ERROR, values };
  }

  // Fuera de un try: redirect lanza para cortar la acción.
  redirect(adminProductPath(data.id));
}
