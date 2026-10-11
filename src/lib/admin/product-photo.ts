/*
 * Reglas de la foto de un producto (decisiones 96 y 97, D6). Puras: las usan la
 * Server Action (ruta, validación) y el navegador (tamaño), y se prueban sin base.
 */

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Lado mayor de la foto que se sube. Una de celular (4000 px, 3 a 8 MB) baja a ~300 KB. */
export const PHOTO_MAX_SIDE = 1600;

/** El límite del bucket (0003 y config.toml). El navegador avisa antes de subir. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS = { "image/webp": "webp", "image/jpeg": "jpg" } as const;
export type PhotoType = keyof typeof EXTENSIONS;
type PhotoExtension = (typeof EXTENSIONS)[PhotoType];

/** null si el bucket no lo acepta. */
export function photoExtension(contentType: string): PhotoExtension | null {
  return Object.hasOwn(EXTENSIONS, contentType) ? EXTENSIONS[contentType as PhotoType] : null;
}

const RANDOM_LENGTH = 12;

/**
 * Nombre único por subida: con el mismo nombre, el navegador y next/image seguirían
 * mostrando la foto vieja. Lo arma el servidor, nunca el navegador.
 */
export function buildPhotoPath(
  slug: string,
  extension: PhotoExtension,
  random = crypto.randomUUID().replaceAll("-", "").slice(0, RANDOM_LENGTH),
): string {
  return `${slug}-${random}.${extension}`;
}

/**
 * D6: la acción que guarda la foto no confía en la ruta que manda el navegador. Tiene
 * que ser exactamente la forma de buildPhotoPath para el slug de ESE producto. El random
 * no lleva guiones, así que "dior-sauvage-edt-…" no pasa por una foto de "dior-sauvage".
 */
export function isPhotoPathFor(path: string, slug: string): boolean {
  return new RegExp(`^${slug}-[0-9a-f]{${RANDOM_LENGTH}}\\.(webp|jpg)$`).test(path);
}

/** Tamaño final: el lado mayor a PHOTO_MAX_SIDE como máximo, sin agrandar. */
export function fitWithin(width: number, height: number) {
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const PHOTO_ERRORS = {
  unreadable: "No se pudo leer la foto. Probá con otra o sacala de nuevo.",
  tooBig: `La foto sigue pesando más de ${PHOTO_MAX_BYTES / (1024 * 1024)} MB después de achicarla. Probá con otra.`,
  upload: "No se pudo subir la foto. Revisá la conexión y tocá Reintentar.",
  save: "La foto se subió pero no se pudo guardar en el producto. Tocá Reintentar.",
  invalidPath: "No pudimos guardar esa foto. Elegila de nuevo.",
  notFound: "Este producto ya no existe. Recargá la página.",
} as const;
