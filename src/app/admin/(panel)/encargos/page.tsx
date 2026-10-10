import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminRequestList } from "@/components/admin/AdminRequestList";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminRequests } from "@/lib/admin/requests";

export const metadata: Metadata = { title: "Encargos" };

/**
 * Encargos de /encargos: pendientes primero (el que más espera arriba). La base no avisa
 * a nadie de un encargo nuevo (decisión 89): esta lista y el número de la navegación son
 * el registro. La sesión y los encargos se leen dentro de <Suspense> (Cache Components).
 */
export default function AdminRequestsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1 text-text uppercase">Encargos</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Requests />
      </Suspense>
    </div>
  );
}

async function Requests() {
  const { supabase } = await requireAdmin();
  const { requests, closedTruncated } = await listAdminRequests(supabase);
  return <AdminRequestList requests={requests} closedTruncated={closedTruncated} />;
}

function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-24 w-full bg-surface-overlay" />
      ))}
    </div>
  );
}
