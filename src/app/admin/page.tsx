import { redirect } from "next/navigation";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";

/** Por ahora el panel es solo pedidos. */
export default function AdminIndexPage() {
  redirect(ADMIN_ORDERS_PATH);
}
