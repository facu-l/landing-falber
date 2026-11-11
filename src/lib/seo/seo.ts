import type { MetadataRoute } from "next";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/catalog";
import { sortVariants } from "@/lib/catalog/catalog";

/**
 * robots.txt y sitemap.xml como reglas puras (sin I/O): src/app/robots.ts y
 * src/app/sitemap.ts solo les pasan el catálogo.
 */

/**
 * Dominio canónico. Es una constante y no una variable de entorno: los deploys de
 * prueba de Netlify también tienen que mandar a Google a falber.com.ar.
 */
export const SITE_URL = "https://falber.com.ar";

export const SITE_NAME = "FALBER";

/**
 * Mismas URLs que SiteFooter.tsx (decisión: duplicado a propósito, igual que
 * cambios-y-devoluciones ↔ merchant-feed. Si cambia una, cambiar la otra).
 */
const SOCIAL_LINKS = [
  "https://www.instagram.com/falber.parfum/",
  "https://www.tiktok.com/@falber.parfum",
  "https://www.facebook.com/profile.php?id=61595043872733",
] as const;

/** Rutas que no se indexan. Las páginas ya llevan `noindex`; esto ahorra el rastreo. */
export const PRIVATE_PATHS = ["/admin", "/carrito", "/checkout", "/pedido"] as const;

const PUBLIC_PAGES = ["/", "/catalogo", "/encargos", "/cambios-y-devoluciones"] as const;

/** JSON-LD Organization, igual en todas las páginas: va una sola vez en el layout raíz. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    sameAs: [...SOCIAL_LINKS],
  };
}

/**
 * JSON-LD Product para una ficha. Un Offer por presentación (igual criterio que
 * merchant-feed.ts: un decant de 5 ml no es la misma oferta que el frasco).
 */
export function productJsonLd(product: CatalogProduct, imageUrl: string | null) {
  const offers = sortVariants(product.variants).map((variant) => variantOffer(product, variant));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: { "@type": "Brand", name: product.brand },
    description: product.description ?? `${product.name} de ${product.brand}. Decants y perfumes FALBER.`,
    ...(imageUrl ? { image: imageUrl } : {}),
    offers,
  };
}

function variantOffer(product: CatalogProduct, variant: CatalogVariant) {
  const typeLabel = variant.variantType === "decant" ? "Decant" : "Frasco";
  return {
    "@type": "Offer",
    sku: variant.id,
    name: `${typeLabel} ${variant.sizeMl} ml`,
    url: `${SITE_URL}/producto/${product.slug}`,
    priceCurrency: "ARS",
    price: variant.price,
    availability: variant.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
  };
}

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
