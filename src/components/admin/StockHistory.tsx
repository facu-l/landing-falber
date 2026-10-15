import Link from "next/link";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";
import { formatSignedQuantity, MOVEMENT_LABELS, STOCK_HISTORY_LIMIT, type StockHistoryEntry } from "@/lib/admin/stock-movements";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

/**
 * Historial de una presentación (D11): los últimos movimientos, del más nuevo al más viejo.
 * Venta y Devuelto por cancelación llevan al pedido.
 */
export function StockHistory({ entries }: { entries: readonly StockHistoryEntry[] }) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-caption text-text-secondary uppercase underline underline-offset-4 hover:text-text">
        Historial (últimos {STOCK_HISTORY_LIMIT})
      </summary>
      {entries.length === 0 ? (
        <p className="text-body-sm text-text-secondary">Sin movimientos todavía.</p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border py-2 text-body-sm">
              <span className="text-text-muted tabular-nums">{formatDateTime(entry.created_at)}</span>
              <span className="text-text">{MOVEMENT_LABELS[entry.movement_type]}</span>
              <span className={cn("tabular-nums", entry.quantity > 0 ? "text-text" : "text-text-secondary")}>
                {formatSignedQuantity(entry.quantity)}
              </span>
              {entry.orders && (
                <Link
                  href={`${ADMIN_ORDERS_PATH}/${entry.orders.id}`}
                  className="text-text-secondary underline underline-offset-4 hover:text-text"
                >
                  Pedido {entry.orders.order_number}
                </Link>
              )}
              {/* La nota de una venta es el número de pedido: ya está en el link. */}
              {entry.note && !entry.orders && <span className="text-text-secondary">{entry.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
