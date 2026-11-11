import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/store/ProductCard";
import { buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  type CatalogFilters,
  GENDER_LABELS,
  VARIANT_TYPE_LABELS,
  brandsOf,
  emptyCatalogMessage,
  filterCatalog,
  hasActiveFilters,
  parseCatalogFilters,
} from "@/lib/catalog/catalog";
import { getCatalog } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Decants y perfumes FALBER. Buscá por marca, género o presentación.",
  // Canonical fijo en /catalogo (sin filtros): los ?marca=/?genero=/?tipo= son la misma
  // página para SEO, no variantes a indexar aparte.
  alternates: { canonical: "/catalogo" },
  openGraph: { url: "/catalogo", title: "Catálogo", description: "Decants y perfumes FALBER. Buscá por marca, género o presentación." },
};

const container = "mx-auto w-full max-w-7xl px-4 md:px-8";
const productGrid = "grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4";

/**
 * Los filtros viven en la URL (?q=&marca=&genero=&tipo=) con un form GET:
 * funcionan sin JavaScript y el link se puede compartir.
 * searchParams es dato de la request: se lee dentro de <Suspense> para que el
 * título y el layout sigan siendo parte del shell estático (Cache Components).
 */
export default function CatalogPage({ searchParams }: PageProps<"/catalogo">) {
  return (
    <div className={`${container} flex flex-col gap-10 py-12 md:py-16`}>
      <h1 className="text-h1 text-text uppercase">Catálogo</h1>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CatalogResults({ searchParams }: Pick<PageProps<"/catalogo">, "searchParams">) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  const filters = parseCatalogFilters(params);
  const results = filterCatalog(catalog, filters);

  return (
    <>
      <FilterForm filters={filters} brands={brandsOf(catalog)} />
      <p className="text-body-sm text-text-muted" aria-live="polite">
        {results.length === 1 ? "1 perfume" : `${results.length} perfumes`}
      </p>
      {results.length > 0 ? (
        <ul className={productGrid}>
          {results.map((p) => (
            <li key={p.id}>
              <ProductCard
                product={p}
                priceType={filters.type ?? undefined}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState filters={filters} />
      )}
    </>
  );
}

function FilterForm({ filters, brands }: { filters: CatalogFilters; brands: string[] }) {
  // key: al cambiar la URL, el form se vuelve a montar con los valores nuevos.
  const formKey = JSON.stringify(filters);

  return (
    <form
      key={formKey}
      action="/catalogo"
      role="search"
      className="grid gap-4 border-b border-border pb-10 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end"
    >
      <Input
        label="Buscar"
        name="q"
        type="search"
        defaultValue={filters.q}
        placeholder="Marca o perfume"
        maxLength={80}
      />
      <Select label="Marca" name="marca" defaultValue={filters.brand ?? ""}>
        <option value="">Todas</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </Select>
      <Select label="Género" name="genero" defaultValue={filters.gender ?? ""}>
        <option value="">Todos</option>
        {Object.entries(GENDER_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select label="Presentación" name="tipo" defaultValue={filters.type ?? ""}>
        <option value="">Todas</option>
        {Object.entries(VARIANT_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <div className="flex items-center gap-6">
        <button type="submit" className={buttonClasses("primary")}>
          Filtrar
        </button>
        {hasActiveFilters(filters) && (
          <Link
            href="/catalogo"
            className="text-label text-text-secondary uppercase underline-offset-8 hover:text-text hover:underline"
          >
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}

function EmptyState({ filters }: { filters: CatalogFilters }) {
  const { title, hint } = emptyCatalogMessage(filters);

  return (
    <div className="flex flex-col items-start gap-6 py-16">
      <p className="text-h2 text-text">{title}</p>
      <p className="max-w-[48ch] text-body text-text-secondary">{hint}</p>
      <div className="flex flex-wrap items-center gap-6">
        {/* Sin filtros ya se está viendo todo: el link no llevaría a ningún lado. */}
        {hasActiveFilters(filters) && (
          <Link href="/catalogo" className={buttonClasses("secondary")}>
            Ver todo
          </Link>
        )}
        <Link
          href="/encargos"
          className="text-label text-text-secondary uppercase underline-offset-8 hover:text-text hover:underline"
        >
          Hacer un encargo
        </Link>
      </div>
    </div>
  );
}

// Esqueleto con la forma final: barra de filtros y grilla de tarjetas 4:5.
function CatalogSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-10">
      <div className="h-[76px] border-b border-border pb-10" />
      <div className={productGrid}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4">
            <div className="aspect-[4/5] rounded-md bg-surface-raised" />
            <div className="h-4 w-1/3 bg-surface-raised" />
            <div className="h-5 w-2/3 bg-surface-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
