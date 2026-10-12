"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdminAction } from "@/lib/admin/auth";
import {
  isDuplicateVariantError,
  parseNewVariant,
  parseVariantEdit,
  VARIANT_ERRORS,
  VARIANT_NOT_SAVED,
  VARIANT_SAVE_ERROR,
  type VariantFormState,
  variantCreatedWithoutStock,
} from "@/lib/admin/product-variants";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { loggableDbError } from "@/lib/db-errors";
import { formValues } from "@/lib/forms/form-data";

/*
 * Acciones de Presentaciones y stock en la ficha de un producto. Con la sesión del admin:
 * los grants de 0001 y 0003 (qué columnas), el unique (producto, tipo, ml) y el ledger de
 * stock deciden. productId y variantId llegan con bind desde el formulario.
 */

/**
 * Agregar presentación. Nace disponible; el stock inicial, si hay, es un movimiento
 * initial_stock (el stock cambia solo en stock_movements). Son dos escrituras: si la
 * segunda falla, la presentación queda y se avisa cómo terminar (decisión 100).
 */
export async function addVariant(
  productId: string,
  _prev: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const access = await requireAdminAction();

  const values = formValues(formData);
  if (!access.ok) return { status: "error", message: access.message, values };

  // Las de la base, no las que vio el navegador: otra pestaña pudo agregar una.
  const { data: existing, error: readError } = await access.supabase
    .from("product_variants")
    .select("variant_type, size_ml")
    .eq("product_id", productId);
  if (readError || !existing) {
    if (readError) console.error("[admin] leer las presentaciones falló", loggableDbError(readError));
    return { status: "error", message: VARIANT_SAVE_ERROR, values };
  }

  const parsed = parseNewVariant(values, existing);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };
  const { variantType, sizeMl, price, initialStock } = parsed.data;

  const { data: variant, error } = await access.supabase
    .from("product_variants")
    .insert({ product_id: productId, variant_type: variantType, size_ml: sizeMl, price, is_available: true })
    .select("id, label")
    .single();

  if (error || !variant) {
    if (error && isDuplicateVariantError(error)) {
      return { status: "error", fieldErrors: { sizeMl: VARIANT_ERRORS.duplicate }, values };
    }
    if (error) console.error("[admin] crear la presentación falló", loggableDbError(error));
    return { status: "error", message: VARIANT_SAVE_ERROR, values };
  }
  // label es una columna generada: nunca es null en una fila insertada.
  const label = variant.label ?? `${sizeMl} ml`;

  // Desde acá la presentación existe: la ficha (y la tienda, si está publicado) tiene que verla.
  if (initialStock > 0) {
    const { error: stockError } = await access.supabase
      .from("stock_movements")
      .insert({ variant_id: variant.id, movement_type: "initial_stock", quantity: initialStock, note: null });
    if (stockError) {
      console.error("[admin] cargar el stock inicial falló", loggableDbError(stockError));
      updateTag(CATALOG_TAG);
      refresh();
      return { status: "partial", message: variantCreatedWithoutStock(label) };
    }
  }

  updateTag(CATALOG_TAG);
  refresh();
  return { status: "success", message: `Se agregó ${label}.` };
}

/** Editar: precio y Disponible. Tipo y ml no se cambian (0003 revoca el update de esas columnas). */
export async function updateVariant(
  variantId: string,
  _prev: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const access = await requireAdminAction();

  const values = formValues(formData);
  if (!access.ok) return { status: "error", message: access.message, values };

  const parsed = parseVariantEdit(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const { data, error } = await access.supabase
    .from("product_variants")
    .update({ price: parsed.data.price, is_available: parsed.data.isAvailable })
    .eq("id", variantId)
    // select: sin él, 0 filas (RLS) "se actualiza" sin error.
    .select("id");

  if (error) {
    console.error("[admin] guardar la presentación falló", loggableDbError(error));
    return { status: "error", message: VARIANT_SAVE_ERROR, values };
  }
  if (!data?.length) return { status: "error", message: VARIANT_NOT_SAVED, values };

  updateTag(CATALOG_TAG);
  refresh();
  return { status: "success", message: "Presentación guardada." };
}
