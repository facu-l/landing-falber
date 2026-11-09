import type { MetadataRoute } from "next";

/**
 * robots.txt y sitemap.xml como reglas puras (sin I/O): src/app/robots.ts y
 * src/app/sitemap.ts solo les pasan el catálogo.
 */

/**
 * Dominio canónico. Es una constante y no una variable de entorno: los deploys de
 * prueba de Netlify también tienen que mandar a Google a falber.com.ar.
 */
export const SITE_URL = "https://falber.com.ar";

/** Rutas que no se indexan. Las páginas ya llevan `noindex`; esto ahorra el rastreo. */
export const PRIVATE_PATHS = ["/admin", "/carrito", "/checkout", "/pedido"] as const;

const PUBLIC_PAGES = ["/", "/catalogo", "/encargos", "/cambios-y-devoluciones"] as const;

export function robotsRules(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

/**
 * Páginas públicas y una entrada por producto activo (los agotados también: su ficha
 * ofrece el encargo). Sin `lastModified`: el catálogo no trae la fecha de edición.
 */
export function sitemapEntries(products: { slug: string }[]): MetadataRoute.Sitemap {
  const paths = [...PUBLIC_PAGES, ...products.map((p) => `/producto/${p.slug}`)];
  return [...new Set(paths)].map((path) => ({ url: `${SITE_URL}${path}` }));
}
