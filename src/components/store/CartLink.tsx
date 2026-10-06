"use client";

import Link from "next/link";
import { cartCount } from "@/lib/cart/cart";
import { useCart } from "@/lib/cart/cart-store";
import { cn } from "@/lib/cn";

/**
 * Link del header al carrito, con las unidades (en el servidor siempre 0: no hay
 * desajuste al hidratar). En mobile es un ícono: con la palabra "Carrito" el header
 * no entra en 375 px junto al wordmark y "Catálogo".
 */
export function CartLink({ className }: { className?: string }) {
  const count = cartCount(useCart());
  const label = count === 0 ? "Carrito" : `Carrito, ${count} ${count === 1 ? "unidad" : "unidades"}`;

  return (
    <Link href="/carrito" aria-label={label} className={cn("relative flex items-center gap-2", className)}>
      <span className="hidden md:inline">Carrito</span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        className="size-5 md:hidden"
      >
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-2 -right-2.5 text-caption text-text tabular-nums md:static">{count}</span>
      )}
    </Link>
  );
}
