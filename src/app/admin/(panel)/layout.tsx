import Link from "next/link";
import { signOut } from "@/app/admin/login/actions";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";

const linkClasses = "inline-flex min-h-11 items-center text-label uppercase text-text-secondary transition-colors duration-150 hover:text-text";

/**
 * Páginas del panel (todo menos el login). La navegación es estática: cada página
 * llama a requireAdmin() dentro de su <Suspense>, que es la que lee la sesión.
 */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-10 md:px-8 md:py-12">
      <nav aria-label="Panel" className="flex items-center justify-between gap-6 border-b border-border pb-4">
        <Link href={ADMIN_ORDERS_PATH} className={linkClasses}>
          Pedidos
        </Link>
        <form action={signOut}>
          <button type="submit" className={linkClasses}>
            Salir
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
