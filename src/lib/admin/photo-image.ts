import { fitWithin, PHOTO_ERRORS, PHOTO_MAX_BYTES } from "./product-photo";

/*
 * Lado del navegador de la foto (decisión 97, D15): decodificar, enderezar, achicar,
 * codificar y subir a la URL firmada. Usa APIs del navegador (createImageBitmap, canvas):
 * el decodificado real y el EXIF los prueba el E2E (fixture con orientación 6); el pase a
 * JPEG, el límite de tamaño y el PUT, photo-image.test.ts con el canvas simulado.
 */

export type PreparedPhoto = { ok: true; blob: Blob } | { ok: false; message: string };

const QUALITY = 0.85;

export const PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * background: color con el que se pinta el canvas antes de dibujar. Un PNG transparente
 * quedaría transparente en WebP (Chrome) y negro en JPEG (Safari no codifica WebP): con
 * el fondo de la foto en la tienda, sale igual en los dos.
 */
export async function preparePhoto(file: File, background: string): Promise<PreparedPhoto> {
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
  // Sin color (el token no se pudo leer) no se pinta: fillStyle = "" se ignora y el canvas
  // quedaría negro, peor que transparente.
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
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
      // Cada subida tiene nombre único y no se pisa (x-upsert false): el contenido de una
      // URL no cambia nunca, así que next/image y la CDN la pueden guardar el año entero.
      headers: { "content-type": blob.type, "cache-control": PHOTO_CACHE_CONTROL, "x-upsert": "false" },
      body: blob,
    });
    return response.ok;
  } catch {
    return false;
  }
}
