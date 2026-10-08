import type { Metadata } from "next";
import { Suspense } from "react";
import { ShippingEstimatesForm } from "@/components/admin/ShippingEstimatesForm";
import { requireAdmin } from "@/lib/admin/auth";
import { getShippingEstimatesForAdmin } from "@/lib/admin/shipping-estimates";

export const metadata: Metadata = { title: "Envíos" };

/**
 * Envíos estimados que ve el cliente en el checkout al elegir "Envío a domicilio".
 * La sesión y los montos son datos de la request: se leen dentro de <Suspense>.
 */
export default function AdminShippingPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-h1 text-text uppercase">Envíos</h1>
        <p className="max-w-prose text-body text-text-secondary">
          Los montos que ve el cliente al elegir envío a domicilio. Son estimados: el costo real de cada
          pedido lo cargás en su detalle.
        </p>
      </div>
      <Suspense fallback={<FormSkeleton />}>
        <Estimates />
      </Suspense>
    </div>
  );
}

async function Estimates() {
  const { supabase } = await requireAdmin();
  return <ShippingEstimatesForm estimates={await getShippingEstimatesForAdmin(supabase)} />;
}

function FormSkeleton() {
  return (
    <div aria-hidden className="flex max-w-sm flex-col gap-6">
      <div className="h-13 w-full bg-surface-overlay" />
      <div className="h-13 w-full bg-surface-overlay" />
      <div className="h-12 w-32 bg-surface-overlay" />
    </div>
  );
}
