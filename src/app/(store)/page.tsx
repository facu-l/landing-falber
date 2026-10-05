import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/store/ProductCard";
import { buttonClasses } from "@/components/ui/Button";
import { type CatalogProduct, featuredProducts, productsWithType } from "@/lib/catalog/catalog";
import { getCatalog } from "@/lib/catalog/queries";
import { cn } from "@/lib/cn";

const container = "mx-auto w-full max-w-7xl px-4 md:px-8";
const sectionTitle = "text-h1 text-text uppercase";
const textLink =
  "text-label text-text-secondary uppercase underline-offset-8 transition-colors duration-150 hover:text-text hover:underline";

export default async function Home() {
  const catalog = await getCatalog();
  const featured = featuredProducts(catalog);
  const decants = productsWithType(catalog, "decant");
  const bottles = productsWithType(catalog, "full_bottle").slice(0, 4);

  return (
    <>
      <Hero />
      {featured.length > 0 && <Featured products={featured} />}
      {decants.length > 0 && <DecantsRow products={decants} />}
      {bottles.length > 0 && <Bottles products={bottles} />}
      <RequestsBand />
    </>
  );
}

// Hero partido: FALBER en Cinzel (uso ceremonial) a la izquierda, el frasco a la derecha.
function Hero() {
  return (
    <section className="border-b border-border">
      <div className={cn(container, "grid items-center gap-10 py-12 md:min-h-[calc(100dvh-72px)] md:grid-cols-2 md:gap-16 md:py-16")}>
        <div className="flex flex-col items-start gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-display-xl text-platinum uppercase">FALBER</h1>
            <p className="text-label text-text-muted uppercase">Fragrance experience</p>
          </div>
          <p className="max-w-[34ch] text-body text-text-secondary">
            Decants y perfumes seleccionados. Probá una fragancia antes de elegir el frasco.
          </p>
          <Link href="/catalogo" className={buttonClasses("primary")}>
            Ver catálogo
          </Link>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-md md:aspect-auto md:h-[min(720px,calc(100dvh-72px-8rem))]">
          <Image
            src="/brand/hero-placeholder.webp"
            alt="Frasco de perfume sobre fondo carbón"
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

// Destacados: uno grande y el resto apilado al lado (nunca tres tarjetas iguales).
function Featured({ products }: { products: CatalogProduct[] }) {
  const [main, ...rest] = products;

  return (
    <section className={cn(container, "flex flex-col gap-10 py-16 md:py-24")}>
      <h2 className={sectionTitle}>Destacados</h2>
      <div className={cn("grid gap-10 md:gap-12", rest.length > 0 && "md:grid-cols-[3fr_2fr]")}>
        <ProductCard product={main} sizes="(min-width: 768px) 55vw, 100vw" />
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-1 md:gap-10">
            {rest.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                sizes="(min-width: 768px) 35vw, 50vw"
                className="md:grid md:grid-cols-[3fr_2fr] md:items-end md:gap-6"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Decants: fila con scroll horizontal (en el celular se recorre con el dedo).
function DecantsRow({ products }: { products: CatalogProduct[] }) {
  return (
    <section className="flex flex-col gap-10 border-y border-border bg-surface-raised py-16 md:py-24">
      <div className={cn(container, "flex flex-col gap-4 md:flex-row md:items-end md:justify-between")}>
        <div className="flex flex-col gap-3">
          <h2 className={sectionTitle}>Decants</h2>
          <p className="max-w-[48ch] text-body text-text-secondary">
            Una fragancia en 5 o 10 ml, para usarla unos días antes de decidir.
          </p>
        </div>
        <Link href="/catalogo?tipo=decant" className={textLink}>
          Ver todos los decants
        </Link>
      </div>
      <ul
        aria-label="Decants"
        className="mx-auto flex w-full max-w-7xl snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pb-4 md:scroll-px-8 md:px-8"
      >
        {products.map((p) => (
          <li key={p.id} className="w-[70%] shrink-0 snap-start sm:w-[40%] md:w-[calc((100%-4.5rem)/4)]">
            <ProductCard product={p} priceType="decant" sizes="(min-width: 768px) 25vw, 70vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

// Frascos: grilla con desfase vertical en desktop para romper la simetría.
function Bottles({ products }: { products: CatalogProduct[] }) {
  return (
    <section className={cn(container, "flex flex-col gap-10 py-16 md:py-24")}>
      <h2 className={sectionTitle}>Frascos</h2>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:pb-12">
        {products.map((p) => (
          <li key={p.id} className="md:even:translate-y-12">
            <ProductCard product={p} priceType="full_bottle" sizes="(min-width: 768px) 25vw, 50vw" />
          </li>
        ))}
      </ul>
      <Link href="/catalogo?tipo=full_bottle" className={cn(textLink, "self-start")}>
        Ver todos los frascos
      </Link>
    </section>
  );
}

// Encargos: franja tipográfica de cierre. La ruta /encargos se construye en la Fase 4.
function RequestsBand() {
  return (
    <section className="border-t border-border">
      <div className={cn(container, "flex flex-col gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-24")}>
        <div className="flex flex-col gap-3">
          <h2 className="text-h1 text-text uppercase">¿No encontrás tu perfume?</h2>
          <p className="max-w-[48ch] text-body text-text-secondary">
            Contanos cuál buscás y te avisamos cuando lo tengamos.
          </p>
        </div>
        <Link href="/encargos" className={buttonClasses("secondary", "self-start md:self-auto")}>
          Hacer un encargo
        </Link>
      </div>
    </section>
  );
}
