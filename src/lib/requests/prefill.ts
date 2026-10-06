import { type CatalogProduct, sortVariants } from "@/lib/catalog/catalog";

/*
 * /encargos?producto=<slug> (decisión 33): el botón "Solicitar disponibilidad" de un
 * producto agotado manda su slug. Con él se precargan perfume y marca, y se ofrecen
 * las presentaciones sin stock (su id va como p_variant_id).
 *
 * Un slug que no está en el catálogo (inexistente o inactivo) no rompe la página:
 * es un encargo libre.
 */

export type RequestPrefill = {
  perfumeName: string;
  brand: string;
  /** Presentaciones sin stock. Vacío: la presentación se escribe a mano. */
  variants: { id: string; label: string }[];
};

export function requestPrefill(
  catalog: CatalogProduct[],
  param: string | string[] | undefined,
): RequestPrefill | null {
  const slug = (Array.isArray(param) ? param[0] : param)?.trim();
  if (!slug) return null;

  const product = catalog.find((p) => p.slug === slug);
  if (!product) return null;

  return {
    perfumeName: product.name,
    brand: product.brand,
    variants: sortVariants(product.variants)
      .filter((v) => !v.inStock)
      .map((v) => ({ id: v.id, label: v.label })),
  };
}
