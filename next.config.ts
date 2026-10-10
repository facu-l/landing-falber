import type { NextConfig } from "next";
import { assertProductionEnv } from "./src/lib/security/env-checks";

// En el build de producción de Netlify, una variable de seguridad mal cargada frena el
// deploy en vez de cortar las ventas con el primer pedido (decisión 87).
assertProductionEnv(process.env);

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
  // Ninguna página se deja embeber en otro sitio (clickjacking sobre "Realizar compra").
  // Strict-Transport-Security y X-Content-Type-Options los agrega Netlify.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
