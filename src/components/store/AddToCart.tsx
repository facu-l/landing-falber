"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { type AddOutcome, MAX_LINES, MAX_QUANTITY } from "@/lib/cart/cart";
import { addItem } from "@/lib/cart/cart-store";
import type { CatalogVariant } from "@/lib/catalog/catalog";
import { cn } from "@/lib/cn";
import { formatARS } from "@/lib/format";

const MESSAGES: Record<AddOutcome, string> = {
  added: "Agregado al carrito.",
  limit_reached: `Ya tenés el máximo de ${MAX_QUANTITY} unidades de esta presentación.`,
  cart_full: `Tu carrito ya tiene ${MAX_LINES} productos distintos. Finalizá esta compra o sacá alguno.`,
};

/*
 * Selector de presentación + "Agregar al carrito" (decisión 33).
 * Radios nativos: el teclado (flechas) y los lectores de pantalla funcionan solos.
 * Recibe las variantes ya ordenadas; solo se guarda variant_id + cantidad.
 */
export function AddToCart({ variants }: { variants: CatalogVariant[] }) {
  const name = useId();
  const [selectedId, setSelectedId] = useState(() => variants.find((v) => v.inStock)?.id ?? null);
  const [outcome, setOutcome] = useState<AddOutcome | null>(null);

  function handleAdd() {
    if (!selectedId) return;
    setOutcome(addItem(selectedId));
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col border-t border-border">
        <legend className="sr-only">Elegí la presentación</legend>
        {variants.map((v) => (
          <label
            key={v.id}
            className={cn(
              "flex items-baseline justify-between gap-4 border-b border-border py-4 pr-2 pl-4",
              "border-l-2 border-l-transparent transition-colors duration-150",
              v.inStock
                ? "cursor-pointer hover:bg-surface-raised has-checked:border-l-accent has-checked:bg-surface-raised"
                : "cursor-not-allowed",
              "has-focus-visible:outline-2 has-focus-visible:outline-accent",
            )}
          >
            <input
              type="radio"
              name={name}
              value={v.id}
              checked={selectedId === v.id}
              disabled={!v.inStock}
              onChange={() => {
                setSelectedId(v.id);
                setOutcome(null);
              }}
              className="sr-only"
            />
            <span className={v.inStock ? "text-body text-text" : "text-body text-text-muted"}>{v.label}</span>
            <span className="flex items-baseline gap-3">
              {!v.inStock && <span className="text-caption text-text-muted uppercase">Sin stock</span>}
              <span className={v.inStock ? "text-body text-text" : "text-body text-text-muted"}>
                {formatARS(v.price)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col items-start gap-3">
        <Button onClick={handleAdd} disabled={!selectedId}>
          Agregar al carrito
        </Button>
        <p role="status" className="flex flex-wrap gap-x-3 text-body-sm text-text-secondary">
          {outcome && MESSAGES[outcome]}
          {outcome && (
            <Link href="/carrito" className="text-text underline underline-offset-4">
              Ver carrito
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
