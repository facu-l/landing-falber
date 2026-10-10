import { countPendingRequests } from "@/lib/admin/requests";
import { createClient } from "@/lib/supabase/server";

/**
 * Número de encargos pendientes, dentro del link "Encargos" de la navegación: avisa
 * de un encargo nuevo sin entrar a la pestaña. Componente de servidor con la sesión
 * del usuario: sin admin, RLS cuenta 0 y no se muestra nada. Va dentro de <Suspense>
 * (lee cookies) para que la navegación siga siendo estática.
 */
export async function PendingRequestsCount() {
  const count = await countPendingRequests(await createClient());
  if (count === 0) return null;

  return (
    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-sm bg-accent px-1.5 text-caption text-on-accent tabular-nums">
      {count}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}
