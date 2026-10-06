import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOrderList } from "@/components/admin/AdminOrderList";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminOrders } from "@/lib/admin/orders";

export const metadata: Metadata = { title: "Pedidos" };

/**
 * Lista de pedidos: pendientes primero (el más viejo arriba) y aviso de los que
 * pg_cron va a cancelar. La sesión y los pedidos son datos de la request: se leen
 * dentro de <Suspense> (Cache Components) y nunca se cachean.
 */
export default function AdminOrdersPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1 text-text uppercase">Pedidos</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Orders />
      </Suspense>
    </div>
  );
}

async function Orders() {
  const { supabase } = await requireAdmin();
  const orders = await listAdminOrders(supabase);
  return <AdminOrderList orders={orders} now={new Date()} />;
}

function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-16 w-full bg-surface-raised" />
      ))}
    </div>
  );
}
