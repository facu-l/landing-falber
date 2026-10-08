"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ADMIN_NAV_ITEM_CLASSES } from "./nav-classes";

/**
 * Link de la navegación del panel. La sección actual (también en sus subpáginas, como el
 * detalle de un pedido) lleva aria-current="page": la anuncia el lector de pantalla y se
 * ve en el color de texto principal.
 */
export function AdminNavLink({ href, children }: { href: string; children: ReactNode }) {
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
