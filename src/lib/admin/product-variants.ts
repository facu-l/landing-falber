import type { VariantType } from "@/lib/catalog/catalog";
import type { DbError } from "@/lib/db-errors";
import { parseWholePesos } from "./pesos";
import { parseWholeUnits, STOCK_QUANTITY_MAX } from "./stock-movements";

/*
 * Presentaciones de la ficha del producto (/admin/productos/[id]): agregar y editar.
 * La base pone la red: unique (producto, tipo, ml), price >= 0, tipo y ml que no se
 * cambian después (0003). Esto avisa antes de enviar. Puras: se prueban sin base.
 */

/** Los decants que vende FALBER. La base no los limita (solo size_ml > 0). */
export const DECANT_SIZES_ML = [3, 5, 10] as const;

/** Topes del formulario: frenan un cero de más. La base no tiene tope. */
export const BOTTLE_SIZE_MAX_ML = 1000;
export const VARIANT_PRICE_MAX = 10_000_000;

export const VARIANT_ERRORS = {
  type: "Elegí Decant o Frasco.",
  decantSize: "Elegí 3, 5 o 10 ml.",
  bottleSize: "Escribí los ml del frasco en números enteros (ej. 100).",
  bottleSizeTooHigh: `Un frasco puede tener hasta ${BOTTLE_SIZE_MAX_ML} ml.`,
  duplicate: "Esa presentación ya existe. Cambiá su precio o su stock desde la lista.",
  priceRequired: "Escribí el precio.",
  priceFormat: "Escribí el precio en pesos, sin centavos (ej. 12000 o 12.000).",
  priceZero: "El precio tiene que ser mayor a 0.",
  priceTooHigh: "Ese precio parece demasiado alto. Revisalo.",
  initialStock: "Escribí el stock inicial en unidades enteras (ej. 5), o dejalo vacío.",
  initialStockTooHigh: `Podés cargar hasta ${STOCK_QUANTITY_MAX} u. de una vez.`,
} as const;

/** Lo mínimo de una presentación existente para validar una nueva (columnas de la base). */
export type ExistingVariant = { variant_type: VariantType; size_ml: number };

function variantExists(existing: readonly ExistingVariant[], type: VariantType, sizeMl: number): boolean {
  return existing.some((v) => v.variant_type === type && v.size_ml === sizeMl);
}

/** Opciones del select de decant: los que ya están van deshabilitados. */
export function decantOptions(existing: readonly ExistingVariant[]): { sizeMl: number; label: string; disabled: boolean }[] {
  return DECANT_SIZES_ML.map((sizeMl) => {
    const disabled = variantExists(existing, "decant", sizeMl);
    return { sizeMl, label: disabled ? `${sizeMl} ml (ya está)` : `${sizeMl} ml`, disabled };
  });
}

/** El decant que se preselecciona después de guardar uno. null = están los tres. */
export function nextFreeDecantSize(existing: readonly ExistingVariant[]): number | null {
  return DECANT_SIZES_ML.find((sizeMl) => !variantExists(existing, "decant", sizeMl)) ?? null;
}

export function parseVariantPrice(raw: string): { success: true; value: number } | { success: false; error: string } {
  const parsed = parseWholePesos(raw, VARIANT_PRICE_MAX);
  if (!parsed.success) {
    return { success: false, error: parsed.reason === "format" ? VARIANT_ERRORS.priceFormat : VARIANT_ERRORS.priceTooHigh };
  }
  if (parsed.value === null) return { success: false, error: VARIANT_ERRORS.priceRequired };
  // La base acepta 0; en el panel es casi seguro un error de tipeo.
  if (parsed.value === 0) return { success: false, error: VARIANT_ERRORS.priceZero };
  return { success: true, value: parsed.value };
}

const VARIANT_TYPES: readonly VariantType[] = ["decant", "full_bottle"];

export type NewVariantFieldErrors = Partial<Record<"variantType" | "sizeMl" | "price" | "initialStock", string>>;

export type NewVariant = { variantType: VariantType; sizeMl: number; price: number; initialStock: number };

function parseSize(type: VariantType, raw: string): { success: true; value: number } | { success: false; error: string } {
  if (type === "decant") {
    // Viene de un select. Number("") es 0, que no está en la lista.
    const value = Number(raw);
    return (DECANT_SIZES_ML as readonly number[]).includes(value)
      ? { success: true, value }
      : { success: false, error: VARIANT_ERRORS.decantSize };
  }
  const parsed = parseWholeUnits(raw, BOTTLE_SIZE_MAX_ML);
  if (!parsed.success) {
    return { success: false, error: parsed.reason === "format" ? VARIANT_ERRORS.bottleSize : VARIANT_ERRORS.bottleSizeTooHigh };
  }
  if (!parsed.value) return { success: false, error: VARIANT_ERRORS.bottleSize };
  return { success: true, value: parsed.value };
}

/** Lo que manda Agregar presentación. Stock inicial vacío = 0 (no se carga movimiento). */
export function parseNewVariant(
  values: Record<string, string | undefined>,
  existing: readonly ExistingVariant[],
): { success: true; data: NewVariant } | { success: false; fieldErrors: NewVariantFieldErrors } {
  const fieldErrors: NewVariantFieldErrors = {};

  const typeValue = values.variantType ?? "";
  const variantType = (VARIANT_TYPES as readonly string[]).includes(typeValue) ? (typeValue as VariantType) : null;
  if (!variantType) fieldErrors.variantType = VARIANT_ERRORS.type;

  let sizeMl: number | null = null;
  if (variantType) {
    const size = parseSize(variantType, values.sizeMl ?? "");
    if (!size.success) fieldErrors.sizeMl = size.error;
    else if (variantExists(existing, variantType, size.value)) fieldErrors.sizeMl = VARIANT_ERRORS.duplicate;
    else sizeMl = size.value;
  }

  const price = parseVariantPrice(values.price ?? "");
  if (!price.success) fieldErrors.price = price.error;

  const stock = parseWholeUnits(values.initialStock ?? "", STOCK_QUANTITY_MAX);
  if (!stock.success) {
    fieldErrors.initialStock = stock.reason === "format" ? VARIANT_ERRORS.initialStock : VARIANT_ERRORS.initialStockTooHigh;
  }

  if (!variantType || sizeMl === null || !price.success || !stock.success) return { success: false, fieldErrors };
  return { success: true, data: { variantType, sizeMl, price: price.value, initialStock: stock.value ?? 0 } };
}

export type VariantEdit = { price: number; isAvailable: boolean };

/** Lo que manda Editar: precio y Disponible. Tipo y ml no se cambian (0003). */
export function parseVariantEdit(
  values: Record<string, string | undefined>,
): { success: true; data: VariantEdit } | { success: false; fieldErrors: Pick<NewVariantFieldErrors, "price"> } {
  const price = parseVariantPrice(values.price ?? "");
  if (!price.success) return { success: false, fieldErrors: { price: price.error } };
  return { success: true, data: { price: price.value, isAvailable: values.isAvailable === "on" } };
}

/** El unique (producto, tipo, ml): otra pestaña la creó antes. Como isDuplicateSlugError. */
export function isDuplicateVariantError(error: DbError): boolean {
  return error.code === "23505" && (error.message ?? "").includes("product_variants_product_id_variant_type_size_ml_key");
}

/** Fallo parcial (decisión 100): la presentación quedó, el movimiento de stock inicial no. */
export function variantCreatedWithoutStock(label: string): string {
  return `Se creó ${label} pero no se cargó el stock inicial. Cargalo con Mover stock.`;
}
