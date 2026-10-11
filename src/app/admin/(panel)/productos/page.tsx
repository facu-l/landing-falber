import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminProductList } from "@/components/admin/AdminProductList";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { requireAdmin } from "@/lib/admin/auth";
import { featuredSummary } from "@/lib/admin/product-list";
import { listAdminProducts } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Productos" };

/**
 * Catálogo del admin: alta corta y la lista agrupada. La carga completa (foto,
 * presentaciones, publicar) se hace en la ficha de cada producto.
 * La sesión y los productos se leen dentro de <Suspense> (Cache Components).
 */
export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1 text-text uppercase">Productos</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Products />
      </Suspense>
    </div>
  );
}

async function Products() {
  const { supabase } = await requireAdmin();
  const products = await listAdminProducts(supabase);

  return (
    <>
      <div className="flex flex-col gap-6">
        {products.length > 0 && <p className="text-body text-text-secondary">{featuredSummary(products)}</p>}
        <NewProductForm defaultOpen={products.length === 0} />
      </div>
      <AdminProductList products={products} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-6 w-2/3 bg-surface-overlay" />
      <div className="h-11 w-48 bg-surface-overlay" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-20 w-full bg-surface-overlay" />
      ))}
    </div>
  );
}
