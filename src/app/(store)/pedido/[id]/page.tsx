import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderDetails } from "@/components/store/OrderDetails";
import { getOrderSummary } from "@/lib/orders/queries";
import { whatsAppNumber } from "@/lib/store-env";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

// El link de un pedido es privado: nunca se indexa.
export const metadata: Metadata = {
  title: "Detalle de tu compra",
  robots: { index: false, follow: false },
};

/*
 * /pedido/<uuid>: el resumen se lee en cada visita (sin caché) dentro de <Suspense>,
 * porque es de una sola persona y cambia cuando el admin confirma el pedido.
 * Un id inválido o inexistente muestra not-found (status 200 + noindex, decisión 30).
 */
export default function OrderPage({ params }: PageProps<"/pedido/[id]">) {
  return (
    <div className="px-4 py-12 md:px-8 md:py-16">
      <Suspense fallback={<OrderSkeleton />}>
        <Order params={params} />
      </Suspense>
    </div>
  );
}

async function Order({ params }: Pick<PageProps<"/pedido/[id]">, "params">) {
  const { id } = await params;
  const order = await getOrderSummary(id);
  if (!order) notFound();

  const whatsAppUrl = buildWhatsAppUrl(whatsAppNumber(), buildWhatsAppMessage(order));
  return <OrderDetails order={order} whatsAppUrl={whatsAppUrl} />;
}

function OrderSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="h-10 w-2/3 bg-surface-raised" />
      <div className="h-32 w-full bg-surface-raised" />
      <div className="h-12 w-1/2 bg-surface-raised" />
    </div>
  );
}
