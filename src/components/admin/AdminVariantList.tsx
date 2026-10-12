"use client";

import { useState } from "react";
import { orderVariantsForAdmin, variantStockText } from "@/lib/admin/product-variants";
import type { AdminProductRow } from "@/lib/admin/product-list";
import type { StockHistoryEntry } from "@/lib/admin/stock-movements";
import { cn } from "@/lib/cn";
import { formatARS } from "@/lib/format";
import { StockHistory } from "./StockHistory";
import { StockMoveForm } from "./StockMoveForm";
import { VariantEditForm } from "./VariantEditForm";

type Variant = AdminProductRow["product_variants"][number];

type Props = {
  variants: readonly Variant[];
  /** Los últimos movimientos de cada presentación, por id (getStockHistories). */
  histories: Readonly<Record<string, readonly StockHistoryEntry[]>>;
};

type Panel = "edit" | "stock";

const PANEL_LABELS: Record<Panel, string> = { edit: "Editar", stock: "Mover stock" };

const toggleClasses =
  "inline-flex min-h-11 items-center text-caption text-text-secondary uppercase underline underline-offset-4 hover:text-text";

/**
 * Presentaciones de la ficha (D8): filas con divisor, el stock grande, las no disponibles
 * al final en text-muted. Editar y Mover stock despliegan su formulario debajo, de a uno
 * por vez en toda la lista. Debajo de cada fila, su historial.
 */
export function AdminVariantList({ variants, histories }: Props) {
  const [open, setOpen] = useState<{ id: string; panel: Panel } | null>(null);

  if (variants.length === 0) {
    return <p className="text-body text-text-secondary">Sin presentaciones. Agregá la primera abajo.</p>;
  }

  const close = () => setOpen(null);

  return (
    <ul className="flex flex-col border-t border-border">
      {orderVariantsForAdmin(variants).map((variant) => {
        const panel = open?.id === variant.id ? open.panel : null;
        const panelId = `presentacion-${variant.id}-panel`;
        return (
          <li key={variant.id} className="flex flex-col gap-4 border-b border-border py-4">
            <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", !variant.is_available && "text-text-muted")}>
              <h3 className={cn("text-body", variant.is_available ? "text-text" : "text-text-muted")}>{variant.label}</h3>
              <span className="text-body tabular-nums">{formatARS(variant.price)}</span>
              <span className="text-h3 tabular-nums">{variantStockText(variant.stock)}</span>
              {!variant.is_available && <span className="text-body-sm">No disponible</span>}
              <div className="ml-auto flex gap-6">
                {(Object.keys(PANEL_LABELS) as Panel[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    // El nombre dice cuál: hay uno por fila. Empieza con el texto visible (label in name).
                    aria-label={`${PANEL_LABELS[kind]} ${variant.label}`}
                    aria-expanded={panel === kind}
                    aria-controls={panelId}
                    onClick={() => setOpen(panel === kind ? null : { id: variant.id, panel: kind })}
                    className={toggleClasses}
                  >
                    {PANEL_LABELS[kind]}
                  </button>
                ))}
              </div>
            </div>
            {panel && (
              <div id={panelId}>
                {panel === "edit" ? (
                  <VariantEditForm variant={variant} onClose={close} />
                ) : (
                  <StockMoveForm variant={variant} onClose={close} />
                )}
              </div>
            )}
            <StockHistory entries={histories[variant.id] ?? []} />
          </li>
        );
      })}
    </ul>
  );
}
