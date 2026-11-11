import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/store/AddToCart";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductImage } from "@/components/store/ProductImage";
import { buttonClasses } from "@/components/ui/Button";
import { type CatalogProduct, GENDER_LABELS, isSoldOut, relatedProducts, sortVariants } from "@/lib/catalog/catalog";
import { productImageSrc } from "@/lib/catalog/images";
import { getCatalog, getProductBySlug } from "@/lib/catalog/queries";
import { formatARS } from "@/lib/format";
import { productJsonLd } from "@/lib/seo/seo";

/*
 * Sin generateStaticParams a propósito: con Cache Components tiene que devolver al
 * menos un slug, y un catálogo vacío (ej. el primer deploy) rompería la build.
 * El layout es el shell estático; el detalle se lee dentro de <Suspense> y los datos
 * salen del catálogo cacheado (tag 'catalog'), así que no hay consulta por visita.
 */

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };

  const title = `${product.name} de ${product.brand}`;
  const description = product.description ?? `${product.name} de ${product.brand}. Decants y perfumes FALBER.`;
  const image = productImageSrc(product.imagePath);
  const url = `/producto/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      url,
      title,
      description,
      // Sin foto (producto sin imagen) cae al OG de marca del layout raíz.
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
      <Link
        href="/catalogo"
        className="inline-flex min-h-11 items-center self-start text-label text-text-secondary uppercase underline-offset-8 hover:text-text hover:underline"
      >
        Volver al catálogo
      </Link>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ProductDetails({ params }: Pick<PageProps<"/producto/[slug]">, "params">) {
  const { slug } = await params;
  // getCatalog() está cacheado (tag 'catalog'): getProductBySlug ya la usa por dentro,
  // así que pedirla de nuevo acá para las sugerencias no agrega una consulta extra.
  const [product, catalog] = await Promise.all([getProductBySlug(slug), getCatalog()]);
  if (!product) notFound();

  return (
    <>
      <article className="grid gap-10 md:grid-cols-2 md:gap-16">
        <script
          type="application/ld+json"
          // JSON propio a partir del catálogo, sin input de usuario: no hay riesgo de inyección.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, productImageSrc(product.imagePath))) }}
        />
        <ProductImage
          imagePath={product.imagePath}
          alt={`${product.brand} ${product.name}`}
          sizes="(min-width: 768px) 50vw, 100vw"
          priority
        />
        <div className="flex flex-col gap-10 md:sticky md:top-28 md:self-start">
          <header className="flex flex-col gap-3">
            <p className="text-label text-text-muted uppercase">{product.brand}</p>
            <h1 className="text-h1 text-text">{product.name}</h1>
            {product.gender && <p className="text-body-sm text-text-secondary">{GENDER_LABELS[product.gender]}</p>}
          </header>
          {product.description && (
            <p className="max-w-[56ch] text-body text-text-secondary">{product.description}</p>
          )}
          <Variants product={product} />
        </div>
      </article>
      <RelatedProducts product={product} catalog={catalog} />
    </>
  );
}

// "También te puede interesar": cross-sell para quien no compró, y enlace contextual
// entre fichas (antes solo se llegaba a cada una desde /catalogo).
function RelatedProducts({ product, catalog }: { product: CatalogProduct; catalog: CatalogProduct[] }) {
  const related = relatedProducts(catalog, product);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="relacionados" className="flex flex-col gap-6 border-t border-border pt-10">
      <h2 id="relacionados" className="text-label text-text-secondary uppercase">
        También te puede interesar
      </h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3">
        {related.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} sizes="(min-width: 768px) 33vw, 50vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

// Con stock: selector + carrito (decisión 33). Agotado: la lista y el pedido de disponibilidad.
function Variants({ product }: { product: CatalogProduct }) {
  const soldOut = isSoldOut(product);

  return (
    <section aria-labelledby="presentaciones" className="flex flex-col gap-6">
      <h2 id="presentaciones" className="text-label text-text-secondary uppercase">
        Presentaciones
      </h2>
      {soldOut ? <SoldOutVariants product={product} /> : <AddToCart variants={sortVariants(product.variants)} />}
    </section>
  );
}

function SoldOutVariants({ product }: { product: CatalogProduct }) {
  return (
    <>
      <ul className="flex flex-col border-t border-border">
        {sortVariants(product.variants).map((v) => (
          <li key={v.id} className="flex items-baseline justify-between gap-4 border-b border-border py-4">
            <span className={v.inStock ? "text-body text-text" : "text-body text-text-muted"}>{v.label}</span>
            <span className="flex items-baseline gap-3">
              {!v.inStock && <span className="text-caption text-text-muted uppercase">Sin stock</span>}
              <span className={v.inStock ? "text-body text-text" : "text-body text-text-muted"}>
                {formatARS(v.price)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-start gap-4">
        <p className="text-body-sm text-text-secondary">
          Por ahora no tenemos stock. Dejanos tus datos y te avisamos cuando vuelva.
        </p>
        <Link href={`/encargos?producto=${product.slug}`} className={buttonClasses("primary")}>
          Solicitar disponibilidad
        </Link>
      </div>
    </>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden className="grid gap-10 md:grid-cols-2 md:gap-16">
      <div className="aspect-[4/5] rounded-md bg-surface-raised" />
      <div className="flex flex-col gap-4">
        <div className="h-4 w-1/4 bg-surface-raised" />
        <div className="h-10 w-2/3 bg-surface-raised" />
        <div className="mt-6 h-24 w-full bg-surface-raised" />
      </div>
    </div>
  );
}
