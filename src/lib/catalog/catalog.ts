import type { Database } from "@/types/database";

/**
 * Modelo del catálogo para la UI y reglas puras sobre él (filtros, precios, agotados).
 * Sin I/O: todo se prueba con Vitest. La consulta a Supabase vive en ./queries.ts.
 */

export type Gender = Database["public"]["Enums"]["product_gender"];
export type VariantType = Database["public"]["Enums"]["variant_type"];

export type CatalogVariant = {
  id: string;
  variantType: VariantType;
  sizeMl: number;
  label: string;
  price: number;
  inStock: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string | null;
  imagePath: string | null;
  gender: Gender | null;
  isFeatured: boolean;
  variants: CatalogVariant[];
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Masculino",
  female: "Femenino",
  unisex: "Unisex",
};

export const VARIANT_TYPE_LABELS: Record<VariantType, string> = {
  decant: "Decants",
  full_bottle: "Frascos",
};

// ---------------------------------------------------------------------------
// Variantes y precios
// ---------------------------------------------------------------------------

/** Variantes ordenadas para mostrar: decants primero, después por tamaño. */
export function sortVariants(variants: CatalogVariant[]): CatalogVariant[] {
  const typeOrder: Record<VariantType, number> = { decant: 0, full_bottle: 1 };
  return [...variants].sort(
    (a, b) => typeOrder[a.variantType] - typeOrder[b.variantType] || a.sizeMl - b.sizeMl,
  );
}

export function isSoldOut(product: CatalogProduct): boolean {
  return !product.variants.some((v) => v.inStock);
}

/**
 * Precio "desde": el más bajo entre las variantes con stock (opcionalmente de un tipo).
 * Si no hay ninguna con stock, el más bajo de todas, para que un agotado igual muestre precio.
 * null si el producto no tiene variantes de ese tipo.
 */
export function fromPrice(product: CatalogProduct, type?: VariantType): number | null {
  const candidates = product.variants.filter((v) => !type || v.variantType === type);
  if (candidates.length === 0) return null;
  const inStock = candidates.filter((v) => v.inStock);
  const pool = inStock.length > 0 ? inStock : candidates;
  return Math.min(...pool.map((v) => v.price));
}

export function hasVariantType(product: CatalogProduct, type: VariantType): boolean {
  return product.variants.some((v) => v.variantType === type);
}

// ---------------------------------------------------------------------------
// Selecciones de la home
// ---------------------------------------------------------------------------

/** Destacados con stock, como máximo `limit`. Un destacado agotado no se promociona. */
export function featuredProducts(products: CatalogProduct[], limit = 3): CatalogProduct[] {
  return products.filter((p) => p.isFeatured && !isSoldOut(p)).slice(0, limit);
}

/** Productos que se venden en una presentación (decant o frasco), con stock primero. */
export function productsWithType(products: CatalogProduct[], type: VariantType): CatalogProduct[] {
  return sortForDisplay(products.filter((p) => hasVariantType(p, type)));
}

/** Los agotados al final; el resto conserva el orden de la consulta (marca, nombre). */
export function sortForDisplay(products: CatalogProduct[]): CatalogProduct[] {
  return [...products].sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)));
}

export function brandsOf(products: CatalogProduct[]): string[] {
  return [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "es"));
}

// ---------------------------------------------------------------------------
// Filtros de /catalogo (viven en la URL: ?q=&marca=&genero=&tipo=)
// ---------------------------------------------------------------------------

export type CatalogFilters = {
  q: string;
  brand: string | null;
  gender: Gender | null;
  type: VariantType | null;
};

type SearchParams = Record<string, string | string[] | undefined>;

const GENDERS = Object.keys(GENDER_LABELS) as Gender[];
const VARIANT_TYPES = Object.keys(VARIANT_TYPE_LABELS) as VariantType[];

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Lee los filtros de la URL. Un valor inválido se ignora (no rompe la página). */
export function parseCatalogFilters(params: SearchParams): CatalogFilters {
  return {
    q: first(params.q).slice(0, 80),
    brand: first(params.marca) || null,
    gender: oneOf(first(params.genero), GENDERS),
    type: oneOf(first(params.tipo), VARIANT_TYPES),
  };
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Boolean(filters.q || filters.brand || filters.gender || filters.type);
}

export type EmptyCatalogMessage = {
  title: string;
  hint: string;
};

/**
 * Texto del catálogo sin resultados según por qué está vacío. Los links del menú
 * ("Decants", "Frascos") llegan con solo ?tipo=: ahí el cliente no eligió filtros
 * y el texto no puede culparlo de algo que no hizo.
 */
export function emptyCatalogMessage(filters: CatalogFilters): EmptyCatalogMessage {
  // Solo la presentación: el link del menú.
  if (filters.type && !filters.q && !filters.brand && !filters.gender) {
    return {
      title: `Todavía no hay ${VARIANT_TYPE_LABELS[filters.type].toLowerCase()}.`,
      hint: "Estamos sumando perfumes. Si buscás uno en particular, podés encargarlo.",
    };
  }
  if (!hasActiveFilters(filters)) {
    return {
      title: "Todavía no hay perfumes cargados.",
      hint: "Estamos sumando perfumes. Si buscás uno en particular, podés encargarlo.",
    };
  }
  return {
    title: "No encontramos perfumes con esos filtros.",
    hint: "Probá con otra marca o sacá algún filtro. Si buscás uno en particular, podés encargarlo.",
  };
}

/** Minúsculas y sin tildes: "Baccarát" encuentra "baccarat". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Género exacto a propósito: elegir "Masculino" no trae los unisex.
 * Es predecible y "Unisex" es una opción propia del filtro.
 */
export function filterCatalog(products: CatalogProduct[], filters: CatalogFilters): CatalogProduct[] {
  const terms = normalizeText(filters.q).split(/\s+/).filter(Boolean);

  const filtered = products.filter((p) => {
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.gender && p.gender !== filters.gender) return false;
    if (filters.type && !hasVariantType(p, filters.type)) return false;
    if (terms.length > 0) {
      const haystack = normalizeText(`${p.brand} ${p.name}`);
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });

  return sortForDisplay(filtered);
}
