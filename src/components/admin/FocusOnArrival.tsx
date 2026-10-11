"use client";

import { useEffect } from "react";

/**
 * Después del alta (D17): el foco va al título del producto nuevo, así el lector de
 * pantalla anuncia dónde quedó el admin. El elemento necesita tabIndex={-1}.
 *
 * Saca ?nuevo=1 con history.replaceState y no con router.replace: este último vuelve a
 * renderizar la página sin el parámetro y el aviso "Producto creado" desaparece al
 * instante. replaceState solo cambia la URL (recargar no repite el aviso).
 */
export function FocusOnArrival({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.focus();
    window.history.replaceState(null, "", window.location.pathname);
  }, [targetId]);

  return null;
}
