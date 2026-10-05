import type { Database } from "@/types/database";
import type { CatalogProduct } from "./catalog";

/**
 * Forma de la consulta del catálogo y su traducción al modelo de la UI.
 * Separado de ./queries.ts (que es server-only) para poder probarlo con Vitest.
 */

// Una sola consulta anidada: productos activos con sus variantes.
export const CATALOG_SELECT =
  "id, slug, name, brand, description, image_path, gender, is_featured, " +
  "product_variants ( id, variant_type, size_ml, label, price, stock, is_available )";

type Products = Database["public"]["Tables"]["products"]["Row"];
type Variants = Database["public"]["Tables"]["product_variants"]["Row"];

export type CatalogRow = Pick<
  Products,
  "id" | "slug" | "name" | "brand" | "description" | "image_path" | "gender" | "is_featured"
> & {
  product_variants: Pick<
    Variants,
    "id" | "variant_type" | "size_ml" | "label" | "price" | "stock" | "is_available"
  >[];
};

/**
 * Fila de Supabase → modelo de la UI.
 * Las variantes con is_available = false no se muestran; un producto sin
 * variantes visibles no tiene nada para vender y queda fuera de la tienda.
 */
export function toCatalogProducts(rows: CatalogRow[]): CatalogProduct[] {
  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      description: row.description,
      imagePath: row.image_path,
      gender: row.gender,
      isFeatured: row.is_featured,
      variants: row.product_variants
        .filter((v) => v.is_available)
        .map((v) => ({
          id: v.id,
          variantType: v.variant_type,
          sizeMl: v.size_ml,
          label: v.label ?? `${v.size_ml} ml`,
          price: Number(v.price),
          inStock: v.stock > 0,
        })),
    }))
    .filter((p) => p.variants.length > 0);
}
