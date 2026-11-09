import { getCatalog } from "@/lib/catalog/queries";
import { productImageSrc } from "@/lib/catalog/images";
import { merchantFeedXml } from "@/lib/seo/merchant-feed";

// Feed de Google Merchant Center. Sale del catálogo cacheado (tag 'catalog'), como el
// sitemap: con Cache Components el GET se prerenderiza y se renueva con el mismo tag.
export async function GET() {
  const xml = merchantFeedXml(await getCatalog(), (path) => productImageSrc(path));
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
