import type { Metadata } from "next";
import { Suspense } from "react";
import { CartSkeleton } from "@/components/store/CartView";
import { CheckoutForm } from "@/components/store/CheckoutForm";
import { buildVariantIndex } from "@/lib/cart/resolve";
import { getCatalog } from "@/lib/catalog/queries";
import { getShippingRatesOrNull } from "@/lib/shipping/queries";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false },
};

// Igual que /carrito: el formulario cruza el carrito con el catálogo cacheado para el resumen.
// Los envíos estimados también vienen cacheados; si fallan, el checkout sigue sin ellos.
export default function CheckoutPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-h1 text-text uppercase">Finalizar compra</h1>
      <Suspense fallback={<CartSkeleton />}>
        <CheckoutWithCatalog />
      </Suspense>
    </div>
  );
}

async function CheckoutWithCatalog() {
  const [catalog, shippingEstimates] = await Promise.all([getCatalog(), getShippingRatesOrNull()]);
  return <CheckoutForm index={buildVariantIndex(catalog)} shippingEstimates={shippingEstimates} />;
}
