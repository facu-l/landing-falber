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
import {
  PRODUCT_DATA_NOT_SAVED,
  PRODUCT_DATA_SAVE_ERROR,
  type ProductDataState,
  parseProductData,
} from "@/lib/admin/product-data";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { loggableDbError } from "@/lib/db-errors";
import { formValues } from "@/lib/forms/form-data";

/*
 * Acciones de la ficha de un producto: la foto y los datos.
 *
 * Foto (decisión 96, D6). El archivo no pasa por acá (límite de 1 MB de
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
 * una ruta de ESTE producto y existir en el bucket. Si el guardado falla y la fila confirma
 * que no se guardó, borra la nueva (no queda huérfana); si no se puede saber (Storage o la
 * base no responden), no borra nada. Si sale bien, borra la anterior (si falla, se loguea).
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

  // exists() da false (con error) si el objeto no está (400/404): la subida no llegó o la ruta
  // es inventada. Un 5xx o la red caída lanzan: eso no prueba que no esté, así que es un
  // error de guardado (Reintentar) y no "elegila de nuevo".
  let exists: boolean;
  try {
    ({ data: exists } = await bucket.exists(path));
  } catch (error) {
    console.error("[admin] verificar la foto subida falló", error instanceof Error ? error.message : error);
    return { ok: false, message: PHOTO_ERRORS.save };
  }
  if (!exists) return { ok: false, message: PHOTO_ERRORS.invalidPath };

  // Compare-and-set: guarda solo si la foto sigue siendo la que se leyó. Con dos pestañas
  // guardando a la vez, la segunda no pisa a la primera (dejaría su foto huérfana): toca
  // 0 filas, borra su foto nueva y el admin reintenta sobre lo que hay ahora.
  const update = access.supabase.from("products").update({ image_path: path }).eq("id", productId);
  const { data, error } = await (product.image_path === null
    ? update.is("image_path", null)
    : update.eq("image_path", product.image_path)
  )
    // select: sin él, 0 filas (RLS o compare-and-set) "se actualiza" sin error.
    .select("id");

  let saved = Boolean(data?.length);
  if (error) {
    console.error("[admin] guardar la foto del producto falló", loggableDbError(error));
    // Un error no prueba que no se guardó (la respuesta se pudo perder después del commit).
    // Antes de borrar la foto nueva se mira la fila: borrarla dejaría la ficha sin imagen.
    const { data: current, error: rereadError } = await readProduct(access.supabase, productId);
    if (rereadError) {
      // Sin saber si se guardó, no se borra: una huérfana se limpia, una ficha sin foto no se ve.
      console.error("[admin] releer el producto tras el fallo falló", loggableDbError(rereadError));
      // Si el guardado sí llegó, que la tienda lo vea (invalidar de más no daña). Sin refresh():
      // con la base caída, re-renderizar la ficha lanza y error.tsx se lleva el campo y Reintentar.
      updateTag(CATALOG_TAG);
      return { ok: false, message: PHOTO_ERRORS.unconfirmed };
    }
    saved = current?.image_path === path;
  }

  if (!saved) {
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

/**
 * Sección Datos de la ficha. El slug no se toca (decisión 94): corregir el nombre no
 * rompe los links compartidos. productId llega con bind desde el formulario.
 */
export async function updateProductData(
  productId: string,
  _prev: ProductDataState,
  formData: FormData,
): Promise<ProductDataState> {
  const access = await requireAdminAction();

  const values = formValues(formData);
  if (!access.ok) return { status: "error", message: access.message, values };

  const parsed = parseProductData(values);
  if (!parsed.success) return { status: "error", fieldErrors: parsed.fieldErrors, values };

  const { data, error } = await access.supabase
    .from("products")
    .update(parsed.data)
    .eq("id", productId)
    // select: sin él, 0 filas (RLS) "se actualiza" sin error.
    .select("id");

  if (error) {
    console.error("[admin] guardar los datos del producto falló", loggableDbError(error));
    return { status: "error", message: PRODUCT_DATA_SAVE_ERROR, values };
  }
  if (!data?.length) return { status: "error", message: PRODUCT_DATA_NOT_SAVED, values };

  // Nombre, descripción o destacado pueden estar a la vista en la tienda.
  updateTag(CATALOG_TAG);
  refresh();
  return { status: "success", message: "Datos guardados." };
}
