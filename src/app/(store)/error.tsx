"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Error de la tienda (ej. Supabase no responde al leer el catálogo). */
export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-24 md:px-8">
      <h1 className="text-h1 text-text uppercase">No pudimos cargar el catálogo</h1>
      <p className="max-w-[48ch] text-body text-text-secondary">
        Es un problema de nuestro lado. Probá de nuevo en unos segundos.
      </p>
      {/* retry vuelve a pedir los datos; reset solo re-renderizaría con el mismo error. */}
      <Button onClick={() => retry()}>Reintentar</Button>
    </div>
  );
}
