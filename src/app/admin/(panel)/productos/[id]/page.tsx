import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductPhotoField } from "@/components/admin/ProductPhotoField";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin/paths";
import { getAdminProduct } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Producto" };

/**
 * Ficha de un producto: encabezado y foto. Presentaciones, datos y publicar llegan en
 * las tareas siguientes de la Fase 7 (documento maestro → Interfaz).
 */
export default function AdminProductPage({ params }: PageProps<"/admin/productos/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Link
        href={ADMIN_PRODUCTS_PATH}
        className="inline-flex min-h-11 items-center self-start text-caption text-text-secondary uppercase underline underline-offset-4 hover:text-text"
      >
        Volver a productos
      </Link>
      <Suspense fallback={<HeaderSkeleton />}>
        <Product params={params} />
      </Suspense>
    </div>
  );
}

async function Product({ params }: Pick<PageProps<"/admin/productos/[id]">, "params">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const product = await getAdminProduct(supabase, id);
  if (!product) notFound();

  const published = product.status === "active";
  const title = `${product.brand} · ${product.name}`;
  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-h1 text-text uppercase">{title}</h1>
        <StatusBadge tone={published ? "active" : "action"}>{published ? "Publicado" : "No publicado"}</StatusBadge>
      </header>
      <section aria-labelledby="producto-foto" className="flex flex-col gap-6 border-t border-border pt-8">
        <h2 id="producto-foto" className="text-h3 text-text uppercase">
          Foto
        </h2>
        <ProductPhotoField productId={product.id} imagePath={product.image_path} alt={title} />
      </section>
    </>
  );
}

function HeaderSkeleton() {
  return <div aria-hidden className="h-10 w-2/3 bg-surface-overlay" />;
}
