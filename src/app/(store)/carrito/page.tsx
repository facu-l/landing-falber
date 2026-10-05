import type { Metadata } from "next";
import { Suspense } from "react";
import { CartSkeleton, CartView } from "@/components/store/CartView";
import { buildVariantIndex } from "@/lib/cart/resolve";
import { getCatalog } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Carrito",
  robots: { index: false },
};

/*
 * El carrito vive en localStorage (solo variant_id + cantidad). La página manda al
 * cliente el índice de variantes del catálogo cacheado (tag 'catalog'), que pone
 * nombres, precios y stock: nunca se confía en un precio guardado en el navegador.
 */
export default function CartPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-h1 text-text uppercase">Carrito</h1>
      <Suspense fallback={<CartSkeleton />}>
        <CartWithCatalog />
      </Suspense>
    </div>
  );
}

async function CartWithCatalog() {
  const index = buildVariantIndex(await getCatalog());
  return <CartView index={index} />;
}
