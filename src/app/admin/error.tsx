"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Error del panel (ej. Supabase no responde al leer los pedidos o al verificar el acceso). */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-24 md:px-8">
      <h1 className="text-h1 text-text uppercase">No pudimos cargar el panel</h1>
      <p className="max-w-[48ch] text-body text-text-secondary">
        Puede ser la conexión con la base. Probá de nuevo en unos segundos.
      </p>
      <Button onClick={() => retry()}>Reintentar</Button>
    </div>
  );
}
