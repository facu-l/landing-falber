"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdminAction } from "@/lib/admin/auth";
import {
  buildPhotoPath,
  isPhotoPathFor,
  PHOTO_ERRORS,
  photoExtension,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/admin/product-photo";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { loggableDbError } from "@/lib/db-errors";

/*
 * Foto de un producto (decisión 96, D6). El archivo no pasa por acá (límite de 1 MB de
 * las Server Actions): esta acción elige la ruta y pide una URL firmada, el navegador
 * sube directo al bucket, y savePhoto valida y guarda la ruta. Las dos con la sesión
 * del admin: Storage y RLS deciden.
 */

export type PhotoActionResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

type Access = Extract<Awaited<ReturnType<typeof requireAdminAction>>, { ok: true }>;

type Bucket = ReturnType<Access["supabase"]["storage"]["from"]>;

/**
 * Borra un objeto y loguea si no pudo. Sin permiso de lectura (RLS), remove() no da
 * error: borra 0 objetos. Por eso también cuenta como falla una respuesta vacía (0004).
 */
async function removeOrLog(bucket: Bucket, path: string, logMessage: string) {
  const { data, error } = await bucket.remove([path]);
  if (error || !data?.length) console.error(logMessage, error?.message ?? "no se borró ningún objeto");
}

async function readProduct(supabase: Access["supabase"], productId: string) {
  return supabase.from("products").select("slug, image_path").eq("id", productId).maybeSingle();
}

/** Paso 1: la URL firmada para subir. La policy "admin uploads" de 0001 autoriza a crearla. */
export async function requestPhotoUpload(
  productId: string,
  contentType: string,
): Promise<PhotoActionResult<{ signedUrl: string; path: string }>> {
  const access = await requireAdminAction();
  if (!access.ok) return { ok: false, message: access.message };

  const extension = photoExtension(contentType);
  if (!extension) return { ok: false, message: PHOTO_ERRORS.unreadable };

  const { data: product, error } = await readProduct(access.supabase, productId);
  if (error) {
    console.error("[admin] leer el producto para la foto falló", loggableDbError(error));
    return { ok: false, message: PHOTO_ERRORS.upload };
  }
  if (!product) return { ok: false, message: PHOTO_ERRORS.notFound };

  const path = buildPhotoPath(product.slug, extension);
  const { data, error: signError } = await access.supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !data) {
    console.error("[admin] pedir la URL para subir la foto falló", signError?.message);
    return { ok: false, message: PHOTO_ERRORS.upload };
  }
  return { ok: true, signedUrl: data.signedUrl, path: data.path };
}

/**
 * Paso 2: guardar la foto subida en el producto. No confía en `path` (D6): tiene que ser
 * una ruta de ESTE producto y existir en el bucket. Si el guardado falla, borra la nueva
 * (no queda huérfana); si sale bien, borra la anterior (si eso falla, solo se loguea).
 */
export async function savePhoto(productId: string, path: string): Promise<PhotoActionResult> {
  const access = await requireAdminAction();
  if (!access.ok) return { ok: false, message: access.message };
  const bucket = access.supabase.storage.from(PRODUCT_IMAGES_BUCKET);

  const { data: product, error: readError } = await readProduct(access.supabase, productId);
  if (readError) {
    console.error("[admin] leer el producto para la foto falló", loggableDbError(readError));
    return { ok: false, message: PHOTO_ERRORS.save };
  }
  if (!product) return { ok: false, message: PHOTO_ERRORS.notFound };
  if (!isPhotoPathFor(path, product.slug)) return { ok: false, message: PHOTO_ERRORS.invalidPath };

  // exists() da false (con error) si el objeto no está: la subida no llegó o la ruta es inventada.
  const { data: exists } = await bucket.exists(path);
  if (!exists) return { ok: false, message: PHOTO_ERRORS.invalidPath };

  const { data, error } = await access.supabase
    .from("products")
    .update({ image_path: path })
    .eq("id", productId)
    // select: sin él, 0 filas (RLS) "se actualiza" sin error.
    .select("id");

  if (error || !data?.length) {
    if (error) console.error("[admin] guardar la foto del producto falló", loggableDbError(error));
    await removeOrLog(bucket, path, "[admin] borrar la foto nueva tras el fallo falló");
    return { ok: false, message: PHOTO_ERRORS.save };
  }

  if (product.image_path && product.image_path !== path) {
    await removeOrLog(bucket, product.image_path, "[admin] borrar la foto anterior falló");
  }

  // Si está publicado, la tienda la muestra cacheada: que vea la nueva ya.
  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true };
}
