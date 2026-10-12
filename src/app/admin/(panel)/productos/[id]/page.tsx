import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { FocusOnArrival } from "@/components/admin/FocusOnArrival";
import { ProductDataForm } from "@/components/admin/ProductDataForm";
import { ProductPhotoField } from "@/components/admin/ProductPhotoField";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { missingForPublishText } from "@/lib/admin/product-data";
import { missingForPublish } from "@/lib/admin/product-list";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin/paths";
import { getAdminProduct } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Producto" };

type Props = PageProps<"/admin/productos/[id]">;

/**
 * Ficha de un producto (D3, D16): encabezado con lo que falta para publicar, después
 * Foto y Datos, una columna. Presentaciones y stock, y Publicar u Ocultar, llegan con
 * el PR 3 de la Fase 7 (documento maestro → Interfaz).
 */
export default function AdminProductPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Link
        href={ADMIN_PRODUCTS_PATH}
        className="inline-flex min-h-11 items-center self-start text-caption text-text-secondary uppercase underline underline-offset-4 hover:text-text"
      >
        Volver a productos
      </Link>
      <Suspense fallback={<ProductSkeleton />}>
        <Product params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Product({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { supabase } = await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const product = await getAdminProduct(supabase, id);
  if (!product) notFound();

  // ?nuevo=1: lo agrega createProduct al terminar el alta.
  const justCreated = query.nuevo === "1";
  const published = product.status === "active";
  const title = `${product.brand} · ${product.name}`;
  const missing = published ? null : missingForPublishText(missingForPublish(product));

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 id="producto-titulo" tabIndex={-1} className="text-h1 text-text uppercase">
            {title}
          </h1>
          <StatusBadge tone={published ? "active" : "action"}>{published ? "Publicado" : "No publicado"}</StatusBadge>
        </div>
        {justCreated && (
          <p role="status" className="text-body text-text-secondary">
            Producto creado. Cargale la foto y revisá los datos.
          </p>
        )}
        {missing && (
          <p id="producto-faltantes" className="text-body text-text-secondary">
            {missing}
          </p>
        )}
        {justCreated && <FocusOnArrival targetId="producto-titulo" />}
      </header>
      <ProductSection id="foto" title="Foto">
        <ProductPhotoField productId={product.id} imagePath={product.image_path} alt={title} />
      </ProductSection>
      <ProductSection id="datos" title="Datos">
        <ProductDataForm product={product} />
      </ProductSection>
    </>
  );
}

/** Cada sección con su h2 y un divisor arriba, como el detalle de un pedido (D17: aria-labelledby). */
function ProductSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const headingId = `producto-${id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6 border-t border-border pt-8">
      <h2 id={headingId} className="text-h3 text-text uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-8">
      <div className="h-10 w-2/3 bg-surface-overlay" />
      <div className="h-72 w-60 bg-surface-overlay" />
      <div className="h-13 w-full bg-surface-overlay" />
    </div>
  );
}
