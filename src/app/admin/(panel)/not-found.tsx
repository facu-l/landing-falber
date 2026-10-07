import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";

/** Pedido inexistente (o un id mal escrito en la URL). */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-6">
      <h1 className="text-h1 text-text uppercase">No encontramos el pedido</h1>
      <p className="text-body text-text-secondary">Revisá el link o buscalo en la lista.</p>
      <Link href={ADMIN_ORDERS_PATH} className={buttonClasses("secondary")}>
        Ver pedidos
      </Link>
    </div>
  );
}
