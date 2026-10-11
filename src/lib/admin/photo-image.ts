import { fitWithin, PHOTO_ERRORS, PHOTO_MAX_BYTES } from "./product-photo";

/*
 * Lado del navegador de la foto (decisión 97, D15): decodificar, enderezar, achicar,
 * codificar y subir a la URL firmada. Usa APIs del navegador (createImageBitmap, canvas):
 * se prueba con el E2E (fixture con EXIF de orientación 6), no con Vitest.
 */

export type PreparedPhoto = { ok: true; blob: Blob } | { ok: false; message: string };

const QUALITY = 0.85;

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    // from-image: aplica la orientación EXIF. Una foto de celular "acostada" queda derecha.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, message: PHOTO_ERRORS.unreadable };
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return { ok: false, message: PHOTO_ERRORS.unreadable };
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Un navegador que no codifica WebP devuelve PNG: blob.type lo delata y se usa JPEG.
  let blob = await encode(canvas, "image/webp");
  if (blob?.type !== "image/webp") blob = await encode(canvas, "image/jpeg");
  if (!blob) return { ok: false, message: PHOTO_ERRORS.unreadable };
  if (blob.size > PHOTO_MAX_BYTES) return { ok: false, message: PHOTO_ERRORS.tooBig };
  return { ok: true, blob };
}

/**
 * PUT a la URL firmada: lo mismo que hace uploadToSignedUrl de storage-js con un archivo,
 * sin cargar el cliente de Supabase en el navegador (no hay cliente de navegador,
 * decisión 73). El token de la URL autoriza; no viaja la sesión.
 */
export async function uploadToSignedUrl(signedUrl: string, blob: Blob): Promise<boolean> {
  try {
    const response = await fetch(signedUrl, {
      method: "PUT",
      headers: { "content-type": blob.type, "cache-control": "max-age=3600", "x-upsert": "false" },
      body: blob,
    });
    return response.ok;
  } catch {
    return false;
  }
}
