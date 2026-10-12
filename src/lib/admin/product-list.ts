import { featuredProducts, normalizeText, sortVariants } from "@/lib/catalog/catalog";
import { CATALOG_SELECT, type CatalogRow, toCatalogProducts } from "@/lib/catalog/rows";
import type { DbError } from "@/lib/db-errors";
import { LIMITS } from "@/lib/forms/limits";
import type { Database } from "@/types/database";

/*
 * Reglas de la lista y el alta de productos del admin (/admin/productos). Puras: se
 * prueban sin base. Las que copian una regla de la base (largos, slug, qué hace falta
 * para publicar) son para mostrar errores amigables: la base decide (0001 y 0003).
 */

export type ProductStatus = Database["public"]["Enums"]["product_status"];

// La consulta del catálogo más el estado: el admin ve también los no publicados.
export const ADMIN_PRODUCT_SELECT = `${CATALOG_SELECT}, status`;

export type AdminProductRow = CatalogRow & { status: ProductStatus };
type VariantRow = AdminProductRow["product_variants"][number];

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

/** Mismos largos que products en 0001 (y que un encargo: /encargos?producto= precarga los dos). */
const NAME_MIN = 2;
const NAME_MAX = LIMITS.perfumeName;
const BRAND_MAX = LIMITS.brand;

export const NEW_PRODUCT_ERRORS = {
  brandRequired: "Escribí la marca.",
  brandLength: `La marca puede tener hasta ${BRAND_MAX} caracteres.`,
  nameRequired: "Escribí el nombre del perfume.",
  nameLength: `El nombre tiene que tener entre ${NAME_MIN} y ${NAME_MAX} caracteres.`,
  noSlug: "El nombre necesita letras o números: con eso se arma el link.",
  duplicateSlug: "Ya hay un producto con ese link. Cambiá el nombre (ej. sumá EDT o EDP).",
} as const;

/**
 * Link del producto: marca y nombre en minúsculas, sin tildes, con guiones
 * ("Dior" + "Sauvage EDT" → "dior-sauvage-edt"). Pasa el check de products.slug,
 * o queda vacío si no hay ninguna letra ni número.
 */
export function slugify(brand: string, name: string): string {
  return normalizeText(`${brand} ${name}`)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type NewProductField = "brand" | "name";
export type NewProductFieldErrors = Partial<Record<NewProductField, string>>;
export type NewProduct = { brand: string; name: string; slug: string };

/** Marca y nombre (ya recortados) contra los largos de la base. Lo comparten el alta y Datos. */
export function brandAndNameErrors(brand: string, name: string): NewProductFieldErrors {
  const fieldErrors: NewProductFieldErrors = {};

  if (!brand) fieldErrors.brand = NEW_PRODUCT_ERRORS.brandRequired;
  else if (brand.length > BRAND_MAX) fieldErrors.brand = NEW_PRODUCT_ERRORS.brandLength;

  if (!name) fieldErrors.name = NEW_PRODUCT_ERRORS.nameRequired;
  else if (name.length < NAME_MIN || name.length > NAME_MAX) fieldErrors.name = NEW_PRODUCT_ERRORS.nameLength;

  return fieldErrors;
}

export function parseNewProduct(
  values: Record<string, string | undefined>,
): { success: true; data: NewProduct } | { success: false; fieldErrors: NewProductFieldErrors } {
  const brand = (values.brand ?? "").trim();
  const name = (values.name ?? "").trim();

  const fieldErrors = brandAndNameErrors(brand, name);
  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };

  const slug = slugify(brand, name);
  if (!slug) return { success: false, fieldErrors: { name: NEW_PRODUCT_ERRORS.noSlug } };
  return { success: true, data: { brand, name, slug } };
}

/**
 * El unique de products.slug. mapDbError solo traduce nuestros códigos (el message de
 * un raise): un 23505 se reconoce antes, por código y nombre del constraint.
 */
export function isDuplicateSlugError(error: DbError): boolean {
  return error.code === "23505" && (error.message ?? "").includes("products_slug_key");
}

/** Estado de la Server Action (useActionState). Fuera de actions.ts: un archivo "use server" solo exporta funciones async. */
export type NewProductState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: NewProductFieldErrors;
      /** Lo escrito: React resetea el form después de la acción. */
      values: Record<NewProductField, string>;
    };

export const INITIAL_NEW_PRODUCT_STATE: NewProductState = { status: "idle" };

export const NEW_PRODUCT_SAVE_ERROR = "No pudimos crear el producto. Probá de nuevo en unos segundos.";

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export type MissingForPublish = "image" | "variant";

export const MISSING_LABELS: Record<MissingForPublish, string> = {
  image: "Falta foto",
  variant: "Falta presentación",
};

/**
 * Copia de guard_product_publish (0003): foto y al menos una presentación disponible.
 * Sin stock sí se publica.
 */
export function missingForPublish(product: Pick<AdminProductRow, "image_path" | "product_variants">): MissingForPublish[] {
  const missing: MissingForPublish[] = [];
  if (!product.image_path?.trim()) missing.push("image");
  if (!product.product_variants.some((v) => v.is_available)) missing.push("variant");
  return missing;
}

/** "Decant 5 ml · 3 u." o "Frasco 100 ml · agotado". Solo las disponibles, en el orden de la tienda. */
export function variantSummaries(variants: readonly VariantRow[]): string[] {
  const available = variants
    .filter((v) => v.is_available)
    .map((v) => ({ variantType: v.variant_type, sizeMl: v.size_ml, label: v.label ?? `${v.size_ml} ml`, stock: v.stock }));
  return sortVariants(available).map(({ label, stock }) => `${label} · ${stock > 0 ? `${stock} u.` : "agotado"}`);
}

const byBrandAndName = (a: AdminProductRow, b: AdminProductRow) =>
  a.brand.localeCompare(b.brand, "es") || a.name.localeCompare(b.name, "es");

/** No publicados arriba (son los que piden algo del admin); cada grupo por marca y nombre. */
export function groupProductsForAdmin(products: readonly AdminProductRow[]) {
  const sorted = [...products].sort(byBrandAndName);
  return {
    unpublished: sorted.filter((p) => p.status !== "active"),
    published: sorted.filter((p) => p.status === "active"),
  };
}

/**
 * "Destacados: N. La home muestra: …". Mismo cálculo que la home: los publicados pasan
 * por toCatalogProducts y featuredProducts, en el orden del catálogo (marca, nombre).
 */
export function featuredSummary(products: readonly AdminProductRow[]): string {
  const featuredCount = products.filter((p) => p.is_featured).length;
  if (featuredCount === 0) return "Sin destacados.";

  const { published } = groupProductsForAdmin(products);
  const shown = featuredProducts(toCatalogProducts(published));
  if (shown.length === 0) {
    return `Destacados: ${featuredCount}. La home no muestra ninguno: hace falta que estén publicados y con stock.`;
  }
  return `Destacados: ${featuredCount}. La home muestra: ${shown.map((p) => `${p.brand} ${p.name}`).join(", ")}.`;
}
