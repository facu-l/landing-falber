import type { createClient } from "@/lib/supabase/server";
import { ADMIN_PRODUCT_SELECT, type AdminProductRow } from "./product-list";

/*
 * Lecturas de productos del admin. Mismo contrato que requests.ts: reciben el cliente de
 * requireAdmin() y corren con la sesión y RLS ("catalog: admin manages products": el
 * admin ve también los no publicados). Nunca service_role. Sin 'use cache': el panel
 * siempre muestra el estado actual.
 */

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Todos los productos con sus presentaciones (~30, decisión 101: sin paginar). */
export async function listAdminProducts(supabase: SessionClient): Promise<AdminProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .order("brand")
    .order("name")
    .overrideTypes<AdminProductRow[], { merge: false }>();

  if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
  return data;
}

/** null si no existe (o el id no es un uuid): la página responde con notFound(). */
export async function getAdminProduct(supabase: SessionClient, id: string): Promise<AdminProductRow | null> {
  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<AdminProductRow, { merge: false }>();

  // 22P02: id con formato inválido. Es una URL mal escrita, no un error del servidor.
  if (error?.code === "22P02") return null;
  if (error) throw new Error(`No se pudo leer el producto: ${error.message}`);
  return data;
}
