import { type Gender, GENDER_LABELS } from "@/lib/catalog/catalog";
import { brandAndNameErrors, type MissingForPublish, type NewProductFieldErrors } from "./product-list";

/*
 * Ficha del producto (/admin/productos/[id]): la sección Datos y el checklist del
 * encabezado. Puras: se prueban sin base.
 */

export type ProductDataField = "brand" | "name" | "gender" | "description" | "featured";
export type ProductDataFieldErrors = NewProductFieldErrors & Partial<Record<"gender", string>>;

export type ProductData = {
  brand: string;
  name: string;
  gender: Gender | null;
  description: string | null;
  is_featured: boolean;
};

export const PRODUCT_DATA_ERRORS = {
  gender: "Elegí un género de la lista.",
} as const;

export const PRODUCT_DATA_SAVE_ERROR = "No pudimos guardar los datos. Probá de nuevo en unos segundos.";
export const PRODUCT_DATA_NOT_SAVED = "No pudimos guardar los datos. Recargá la página y probá de nuevo.";

const GENDERS = Object.keys(GENDER_LABELS) as Gender[];

/**
 * Lo que se edita en Datos. El slug no se lee: queda fijo aunque cambie el nombre
 * (decisión 94, SLUG_LOCKED). Un checkbox sin tildar no viaja en el form.
 */
export function parseProductData(
  values: Record<string, string | undefined>,
): { success: true; data: ProductData } | { success: false; fieldErrors: ProductDataFieldErrors } {
  const brand = (values.brand ?? "").trim();
  const name = (values.name ?? "").trim();
  const genderValue = values.gender ?? "";
  const fieldErrors: ProductDataFieldErrors = brandAndNameErrors(brand, name);

  // "" = "Sin género" en el select.
  let gender: Gender | null = null;
  if (genderValue !== "") {
    if ((GENDERS as string[]).includes(genderValue)) gender = genderValue as Gender;
    else fieldErrors.gender = PRODUCT_DATA_ERRORS.gender;
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return {
    success: true,
    data: {
      brand,
      name,
      gender,
      description: (values.description ?? "").trim() || null,
      is_featured: values.featured === "on",
    },
  };
}

/** Estado de la Server Action (useActionState). Fuera de actions.ts: un archivo "use server" solo exporta funciones async. */
export type ProductDataState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: ProductDataFieldErrors;
      /** Lo escrito: React resetea el form después de la acción. */
      values: Record<string, string>;
    };

export const INITIAL_PRODUCT_DATA_STATE: ProductDataState = { status: "idle" };

const MISSING_TEXT: Record<MissingForPublish, string> = {
  image: "foto",
  variant: "una presentación disponible",
};

/** "Para publicar falta: foto · una presentación disponible", o null si no falta nada. */
export function missingForPublishText(missing: readonly MissingForPublish[]): string | null {
  if (missing.length === 0) return null;
  return `Para publicar falta: ${missing.map((item) => MISSING_TEXT[item]).join(" · ")}`;
}
