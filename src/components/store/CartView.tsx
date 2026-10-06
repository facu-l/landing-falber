"use client";

import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { MAX_QUANTITY } from "@/lib/cart/cart";
import { removeItem, updateQuantity, useCart } from "@/lib/cart/cart-store";
import { type CartItemView, resolveCart, type VariantIndex } from "@/lib/cart/resolve";
import { formatARS } from "@/lib/format";
import { useIsClient } from "@/lib/use-is-client";
import { ProductImage } from "./ProductImage";

const QUANTITIES = Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1);

/**
 * El carrito: lo guardado en localStorage (variant_id + cantidad) cruzado con el
 * catálogo del servidor (`index`), que pone nombres, precios y disponibilidad.
 */
export function CartView({ index }: { index: VariantIndex }) {
  const cart = useCart();
  const isClient = useIsClient();

  if (!isClient) return <CartSkeleton />;
  if (cart.length === 0) return <EmptyCart />;

  const { items, missing, total, canCheckout } = resolveCart(cart, index);

  return (
    <div className="grid gap-12 md:grid-cols-[1fr_20rem] md:gap-16">
      <section aria-label="Productos" className="flex flex-col gap-6">
        {missing.length > 0 && (
          <div role="alert" className="flex flex-col items-start gap-4 border border-border-strong p-4">
            <p className="text-body-sm text-error">
              {missing.length === 1
                ? "Un producto de tu carrito ya no está disponible."
                : `${missing.length} productos de tu carrito ya no están disponibles.`}
            </p>
            <Button variant="secondary" onClick={() => missing.forEach(removeItem)}>
              Quitar los no disponibles
            </Button>
          </div>
        )}
        <ul className="flex flex-col border-t border-border">
          {items.map((item) => (
            <CartItem key={item.variantId} item={item} />
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-4 md:sticky md:top-28 md:self-start">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
          <span className="text-label text-text-secondary uppercase">Total estimado</span>
          <span data-testid="cart-total" className="text-h2 text-text tabular-nums">
            {formatARS(total)}
          </span>
        </div>
        <p className="text-caption text-text-muted">El envío, si corresponde, se coordina por WhatsApp.</p>
        {canCheckout ? (
          <Link href="/checkout" className={buttonClasses("primary", "w-full")}>
            Finalizar compra
          </Link>
        ) : (
          <p className="text-body-sm text-text-secondary">Quitá los productos sin stock o no disponibles para seguir.</p>
        )}
      </aside>
    </div>
  );
}

function CartItem({ item }: { item: CartItemView }) {
  const name = `${item.productName} ${item.label}`;

  return (
    <li className="grid grid-cols-[5rem_1fr] gap-4 border-b border-border py-6 md:grid-cols-[6rem_1fr_auto] md:gap-6">
      <ProductImage imagePath={item.imagePath} alt={`${item.brand} ${item.productName}`} sizes="96px" />

      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-muted uppercase">{item.brand}</p>
        <Link href={`/producto/${item.slug}`} className="text-h3 text-text underline-offset-4 hover:underline">
          {item.productName}
        </Link>
        <p className="text-body-sm text-text-secondary">
          {item.label} · {formatARS(item.unitPrice)}
        </p>
        {!item.inStock && (
          <p className="text-body-sm text-error">Sin stock. Quitalo para seguir con la compra.</p>
        )}
      </div>

      <div className="col-span-2 flex items-end justify-between gap-4 md:col-span-1 md:flex-col md:items-end">
        {item.inStock && (
          <Select
            label="Cantidad"
            aria-label={`Cantidad de ${name}`}
            value={item.quantity}
            onChange={(e) => updateQuantity(item.variantId, Number(e.target.value))}
            className="w-24"
          >
            {QUANTITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </Select>
        )}
        <div className="flex flex-col items-end gap-2">
          {item.inStock && <span className="text-body text-text tabular-nums">{formatARS(item.lineTotal)}</span>}
          <button
            type="button"
            onClick={() => removeItem(item.variantId)}
            aria-label={`Quitar ${name}`}
            className="text-caption text-text-secondary uppercase underline-offset-4 hover:text-text hover:underline"
          >
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}

export function EmptyCart() {
  return (
    <div className="flex flex-col items-start gap-6">
      <p className="text-body text-text-secondary">Tu carrito está vacío.</p>
      <Link href="/catalogo" className={buttonClasses("secondary")}>
        Ver catálogo
      </Link>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-24 w-full bg-surface-raised" />
      <div className="h-24 w-full bg-surface-raised" />
    </div>
  );
}
