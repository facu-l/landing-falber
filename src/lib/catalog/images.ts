/**
 * URL de la foto de un producto a partir de products.image_path (ruta dentro del bucket).
 *
 * - Si NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL está definida, se usa como base.
 *   En local y en CI vale "/product-images" (fotos de prueba en public/, porque
 *   Storage local no funciona: decisión 22).
 * - Si no, se arma la URL pública del bucket product-images de Supabase Storage.
 *
 * Así la base de datos guarda lo mismo en todos los entornos y solo cambia la variable.
 */
type ImageEnv = {
  NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

// Acceso literal a process.env.NEXT_PUBLIC_*: Next solo incrusta en el cliente los accesos escritos así.
const defaultEnv: ImageEnv = {
  NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL: process.env.NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

export function productImageSrc(imagePath: string | null, env: ImageEnv = defaultEnv): string | null {
  if (!imagePath) return null;
  const path = imagePath.split("/").map(encodeURIComponent).join("/");

  const base = env.NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${path}`;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path}`;
}
