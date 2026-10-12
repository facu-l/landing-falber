import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { ADMIN_PRODUCTS_PATH } from "@/lib/admin/paths";

/**
 * Producto inexistente (o un id mal escrito en la URL). Sin este archivo, notFound()
 * usaría el del panel, que habla de un pedido.
 */
export default function AdminProductNotFound() {
  return (
    <div className="flex flex-col items-start gap-6">
      <h1 className="text-h1 text-text uppercase">No encontramos el producto</h1>
      <p className="text-body text-text-secondary">Revisá el link o buscalo en la lista.</p>
      <Link href={ADMIN_PRODUCTS_PATH} className={buttonClasses("secondary")}>
        Ver productos
      </Link>
    </div>
  );
}
