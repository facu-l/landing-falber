/**
 * URL de la foto de un producto a partir de products.image_path (ruta dentro del bucket):
 * la URL pública del bucket product-images de Supabase Storage. Vale en todos los entornos:
 * en local y CI el bucket lo levanta `supabase start` con las fotos del seed.
 */
type ImageEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

// Acceso literal a process.env.NEXT_PUBLIC_*: Next solo incrusta en el cliente los accesos escritos así.
const defaultEnv: ImageEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

export function productImageSrc(imagePath: string | null, env: ImageEnv = defaultEnv): string | null {
  if (!imagePath) return null;
  const path = imagePath.split("/").map(encodeURIComponent).join("/");

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path}`;
}
