import type { Metadata } from "next";
import { Suspense } from "react";
import { PerfumeRequestForm } from "@/components/store/PerfumeRequestForm";
import { getCatalog } from "@/lib/catalog/queries";
import { requestPrefill } from "@/lib/requests/prefill";

export const metadata: Metadata = {
  title: "Encargos",
  description: "¿No encontrás tu perfume? Encargalo en FALBER y te escribimos por WhatsApp.",
  // Canonical fijo: ?producto=<slug> prellena el form, no es una página distinta.
  alternates: { canonical: "/encargos" },
  openGraph: {
    url: "/encargos",
    title: "Encargos",
    description: "¿No encontrás tu perfume? Encargalo en FALBER y te escribimos por WhatsApp.",
  },
};

/**
 * "¿No encontrás tu perfume?"
 * ?producto=<slug> llega desde "Solicitar disponibilidad" de un producto agotado
 * (decisión 33). searchParams es dato de la request: se lee dentro de <Suspense> para
 * que el título siga siendo parte del shell estático (Cache Components).
 */
export default function RequestsPage({ searchParams }: PageProps<"/encargos">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16">
      <header className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-h1 text-text uppercase">¿No encontrás tu perfume?</h1>
        <p className="text-body text-text-secondary">
          Contanos cuál buscás. Lo conseguimos y te escribimos por WhatsApp con disponibilidad y precio.
        </p>
      </header>
      <Suspense fallback={<FormSkeleton />}>
        <RequestFormWithPrefill searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function RequestFormWithPrefill({ searchParams }: Pick<PageProps<"/encargos">, "searchParams">) {
  const [catalog, params] = await Promise.all([getCatalog(), searchParams]);
  return <PerfumeRequestForm prefill={requestPrefill(catalog, params.producto)} />;
}

function FormSkeleton() {
  return (
    <div aria-hidden className="flex max-w-2xl flex-col gap-6">
      <div className="h-4 w-1/4 bg-surface-raised" />
      <div className="h-13 w-full bg-surface-raised" />
      <div className="h-13 w-full bg-surface-raised" />
      <div className="h-13 w-full bg-surface-raised" />
    </div>
  );
}
