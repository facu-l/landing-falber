import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import type { Database } from "@/types/database";
import { supabasePublicEnv } from "@/lib/supabase/env";
import type { CatalogProduct } from "./catalog";
import { CATALOG_SELECT, type CatalogRow, toCatalogProducts } from "./rows";

/** Tag del catálogo. Se invalida al crear o cancelar pedidos y al editar en el admin (decisión 3). */
export const CATALOG_TAG = "catalog";

/**
 * Catálogo completo, cacheado.
 *
 * - Cliente anónimo SIN cookies: una función con 'use cache' no puede leer cookies,
 *   y el catálogo es igual para todos (RLS solo deja ver productos activos).
 * - cacheLife('minutes'): además del tag, se refresca solo cada minuto. Hace falta
 *   porque en el MVP los productos y el stock se editan en Supabase Studio, que no
 *   puede invalidar el tag de Next.
 * - Con pocos perfumes, una sola entrada de caché es más simple que una consulta por filtro:
 *   /catalogo y /producto/[slug] filtran sobre este resultado.
 */
export async function getCatalog(): Promise<CatalogProduct[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("minutes");

  const { url, publishableKey } = supabasePublicEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .order("brand")
    .order("name")
    .overrideTypes<CatalogRow[], { merge: false }>();

  // Un error acá lo muestra el error.tsx de la tienda; no se cachea un catálogo vacío.
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);
  return toCatalogProducts(data);
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const catalog = await getCatalog();
  return catalog.find((p) => p.slug === slug) ?? null;
}
