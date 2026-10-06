import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminOrderDetail } from "@/components/admin/AdminOrderDetail";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { ShippingCostForm } from "@/components/admin/ShippingCostForm";
import { FormSection } from "@/components/ui/FormSection";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";
import { canSetShippingCost } from "@/lib/admin/shipping";

export const metadata: Metadata = { title: "Pedido" };

/** Detalle de un pedido: datos, cambio de estado y costo de envío. */
export default function AdminOrderPage({ params }: PageProps<"/admin/pedidos/[id]">) {
  return (
    <div className="flex flex-col gap-8">
      <Link
        href={ADMIN_ORDERS_PATH}
        className="self-start text-caption text-text-secondary uppercase underline underline-offset-4 hover:text-text"
      >
        Volver a pedidos
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Order params={params} />
      </Suspense>
    </div>
  );
}

async function Order({ params }: Pick<PageProps<"/admin/pedidos/[id]">, "params">) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const order = await getAdminOrder(supabase, id);
  if (!order) notFound();

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-h1 text-text uppercase">{order.order_number}</h1>
        <OrderStatusBadge status={order.status} />
      </header>
      <AdminOrderDetail order={order} />
      <div className="flex max-w-xl flex-col gap-10 border-t border-border pt-8">
        <FormSection title="Estado">
          <OrderStatusForm order={order} />
        </FormSection>
        {canSetShippingCost(order) && (
          <FormSection title="Costo de envío">
            <ShippingCostForm orderId={order.id} shippingCost={order.shipping_cost} />
          </FormSection>
        )}
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="h-10 w-1/3 bg-surface-raised" />
      <div className="h-48 w-full bg-surface-raised" />
    </div>
  );
}
