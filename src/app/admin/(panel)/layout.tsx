import { signOut } from "@/app/admin/login/actions";
import { Suspense } from "react";
import { AdminNavLink } from "@/components/admin/AdminNavLink";
import { ADMIN_NAV_ITEM_CLASSES } from "@/components/admin/nav-classes";
import { PendingRequestsCount } from "@/components/admin/PendingRequestsCount";
import { ADMIN_ORDERS_PATH, ADMIN_REQUESTS_PATH, ADMIN_SHIPPING_PATH } from "@/lib/admin/paths";

/**
 * Páginas del panel (todo menos el login). La navegación es estática: cada página
 * llama a requireAdmin() dentro de su <Suspense>, que es la que lee la sesión. La única
 * parte dinámica es el número de encargos pendientes, en su propio <Suspense>.
 */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-12">
      {/* flex-wrap en los dos niveles: en un celular angosto las pestañas bajan de renglón en vez de desbordar. */}
      <nav
        aria-label="Panel"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border pb-4"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <AdminNavLink href={ADMIN_ORDERS_PATH}>Pedidos</AdminNavLink>
          <AdminNavLink href={ADMIN_REQUESTS_PATH}>
            Encargos
            <Suspense fallback={null}>
              <PendingRequestsCount />
            </Suspense>
          </AdminNavLink>
          <AdminNavLink href={ADMIN_SHIPPING_PATH}>Envíos</AdminNavLink>
        </div>
        <form action={signOut}>
          <button type="submit" className={ADMIN_NAV_ITEM_CLASSES}>
            Salir
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
