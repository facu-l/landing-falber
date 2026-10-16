import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog/queries";
import { sitemapEntries } from "@/lib/seo/seo";

// Sale del mismo catálogo cacheado (tag 'catalog'): un producto publicado u oculto en
// el admin entra o sale del sitemap con la misma invalidación.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(await getCatalog());
}
