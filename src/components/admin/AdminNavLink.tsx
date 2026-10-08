"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { cn } from "@/lib/cn";
import { ADMIN_NAV_ITEM_CLASSES } from "./nav-classes";

type Props = { href: string; children: ReactNode };

/**
 * Link de la navegación del panel. La sección actual (también en sus subpáginas, como el
 * detalle de un pedido) lleva aria-current="page": la anuncia el lector de pantalla y se
 * ve en el color de texto principal.
 *
 * Suspense: con Cache Components, usePathname() suspende al prerenderizar una ruta con un
 * param dinámico (/admin/pedidos/[id]) y sin el boundary la build falla. Mientras tanto se
 * muestra el mismo link sin marcar (guía de Next: use-pathname.md).
 */
export function AdminNavLink({ href, children }: Props) {
  return (
    <Suspense
      fallback={
        <Link href={href} className={ADMIN_NAV_ITEM_CLASSES}>
          {children}
        </Link>
      }
    >
      <CurrentAwareLink href={href}>{children}</CurrentAwareLink>
    </Suspense>
  );
}

function CurrentAwareLink({ href, children }: Props) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(ADMIN_NAV_ITEM_CLASSES, "aria-[current=page]:text-text")}
    >
      {children}
    </Link>
  );
}
