import type { NextConfig } from "next";

// Fotos de producto en producción: bucket público product-images de Supabase Storage.
// En local y CI vienen de public/product-images (NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // 'use cache' + cacheTag('catalog'): el catálogo se prerenderiza y se invalida por tag.
  cacheComponents: true,
  images: {
    remotePatterns: supabaseUrl
      ? [new URL(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/**`)]
      : [],
  },
};

export default nextConfig;
