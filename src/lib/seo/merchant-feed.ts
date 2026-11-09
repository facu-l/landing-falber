import { type CatalogProduct, type CatalogVariant, VARIANT_TYPE_LABELS, sortVariants } from "@/lib/catalog/catalog";
import { SITE_URL } from "./seo";

/**
 * Feed de productos para Google Merchant Center (RSS 2.0 con el namespace g:), como
 * regla pura: src/app/merchant-feed.xml/route.ts solo le pasa el catálogo.
 *
 * Merchant Center lo descarga cada 24 h desde "Añadir productos desde un archivo"
 * → "Introduce un enlace a tu archivo" con `${SITE_URL}/merchant-feed.xml`.
 *
 * Un ítem por presentación (variante): Google quiere un precio y una disponibilidad
 * por ítem, y un decant de 5 ml no es el mismo producto que el frasco. Las variantes
 * de un perfume se agrupan con `item_group_id`.
 */

export const MERCHANT_FEED_PATH = "/merchant-feed.xml";

/** Taxonomía de Google: Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne. */
const GOOGLE_PERFUME_CATEGORY = "479";

type ImageUrl = (imagePath: string | null) => string | null;

export type MerchantItem = {
  id: string;
  itemGroupId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  availability: "in_stock" | "out_of_stock";
  price: string;
  brand: string;
  gender: string | null;
  productType: string;
};

/**
 * Productos sin foto quedan afuera: `image_link` es obligatorio y Google rechazaría
 * el ítem igual. Los agotados entran como `out_of_stock` (la ficha ofrece el encargo).
 */
export function merchantItems(products: CatalogProduct[], imageUrl: ImageUrl): MerchantItem[] {
  return products.flatMap((product) => {
    const imageLink = imageUrl(product.imagePath);
    if (!imageLink) return [];

    return sortVariants(product.variants).map((variant) => toItem(product, variant, imageLink));
  });
}

function toItem(product: CatalogProduct, variant: CatalogVariant, imageLink: string): MerchantItem {
  // Tipo y tamaño en vez de `label`: es texto libre del admin y ya puede traer el tipo
  // ("Decant 5 ml"), con lo que el título lo repetiría.
  const typeLabel = variant.variantType === "decant" ? "Decant" : "Frasco";
  return {
    id: variant.id,
    itemGroupId: product.id,
    title: `${product.brand} ${product.name} - ${typeLabel} ${variant.sizeMl} ml`,
    description: product.description ?? `${product.name} de ${product.brand}. Decants y perfumes FALBER.`,
    link: `${SITE_URL}/producto/${product.slug}`,
    imageLink,
    availability: variant.inStock ? "in_stock" : "out_of_stock",
    price: `${variant.price.toFixed(2)} ARS`,
    brand: product.brand,
    gender: product.gender,
    productType: `Perfumes > ${VARIANT_TYPE_LABELS[variant.variantType]}`,
  };
}

export function merchantFeedXml(products: CatalogProduct[], imageUrl: ImageUrl): string {
  const items = merchantItems(products, imageUrl).map(itemXml).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>FALBER</title>
<link>${SITE_URL}</link>
<description>Decants y perfumes FALBER</description>
${items}
</channel>
</rss>
`;
}

function itemXml(item: MerchantItem): string {
  const fields: [string, string | null][] = [
    ["g:id", item.id],
    ["g:item_group_id", item.itemGroupId],
    ["g:title", item.title],
    ["g:description", item.description],
    ["g:link", item.link],
    ["g:image_link", item.imageLink],
    ["g:availability", item.availability],
    ["g:price", item.price],
    ["g:brand", item.brand],
    ["g:condition", "new"],
    // Sin GTIN: los decants no tienen código de barras propio.
    ["g:identifier_exists", "no"],
    ["g:google_product_category", GOOGLE_PERFUME_CATEGORY],
    ["g:product_type", item.productType],
    // Google acepta male / female / unisex, los mismos valores del enum de la base.
    ["g:gender", item.gender],
    ["g:age_group", "adult"],
  ];
  const lines = fields
    .filter((field): field is [string, string] => field[1] !== null)
    .map(([tag, value]) => `  <${tag}>${escapeXml(value)}</${tag}>`);
  return `<item>\n${lines.join("\n")}\n</item>`;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
