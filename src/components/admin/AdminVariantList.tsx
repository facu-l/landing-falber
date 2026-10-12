"use client";

import { useState } from "react";
import { orderVariantsForAdmin, variantStockText } from "@/lib/admin/product-variants";
import type { AdminProductRow } from "@/lib/admin/product-list";
import { cn } from "@/lib/cn";
import { formatARS } from "@/lib/format";
import { VariantEditForm } from "./VariantEditForm";

type Variant = AdminProductRow["product_variants"][number];

type Props = { variants: readonly Variant[] };

/**
 * Presentaciones de la ficha (D8): filas con divisor, el stock grande, las no disponibles
 * al final en text-muted. Editar despliega su formulario debajo, de a uno por vez.
 */
export function AdminVariantList({ variants }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (variants.length === 0) {
    return <p className="text-body text-text-secondary">Sin presentaciones. Agregá la primera abajo.</p>;
  }

  return (
    <ul className="flex flex-col border-t border-border">
      {orderVariantsForAdmin(variants).map((variant) => {
        const open = openId === variant.id;
        const panelId = `presentacion-${variant.id}-editar`;
        return (
          <li key={variant.id} className="flex flex-col gap-4 border-b border-border py-4">
            <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", !variant.is_available && "text-text-muted")}>
              <h3 className={cn("text-body", variant.is_available ? "text-text" : "text-text-muted")}>{variant.label}</h3>
              <span className="text-body tabular-nums">{formatARS(variant.price)}</span>
              <span className="text-h3 tabular-nums">{variantStockText(variant.stock)}</span>
              {!variant.is_available && <span className="text-body-sm">No disponible</span>}
              <button
                type="button"
                // El nombre dice cuál: hay un Editar por fila. Empieza con el texto visible (label in name).
                aria-label={`Editar ${variant.label}`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : variant.id)}
                className="ml-auto inline-flex min-h-11 items-center text-caption text-text-secondary uppercase underline underline-offset-4 hover:text-text"
              >
                Editar
              </button>
            </div>
            {open && (
              <div id={panelId}>
                <VariantEditForm variant={variant} onClose={() => setOpenId(null)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
