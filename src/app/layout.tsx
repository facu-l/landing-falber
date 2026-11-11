import type { Metadata } from "next";
import { Cinzel, Montserrat } from "next/font/google";
import { SITE_NAME, SITE_URL, organizationJsonLd } from "@/lib/seo/seo";
import "./globals.css";

// Ambas son variable fonts: un solo archivo cubre todos los pesos.
// Exponen --font-cinzel y --font-montserrat, que globals.css usa en @theme.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

// icon.png (512x512) como imagen de OG por defecto: sirve para el preview de marca
// en catálogo/encargos/etc. Las fichas de producto pisan esto con su propia foto.
const DEFAULT_OG_IMAGE = "/icon.png";

// Título y descripción: se mantiene la línea de marca definida en DESIGN.md
// ("Fragrance experience") tal cual estaba — no es un cambio de copy de marca,
// solo se agregan metadataBase/canonical/OG que no existían.
const DEFAULT_TITLE = "FALBER · Fragrance experience";
const DEFAULT_DESCRIPTION = "Decants y perfumes FALBER. Fragrance experience.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · FALBER",
  },
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "es_AR",
    url: "/",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      data-theme="dark"
      className={`${cinzel.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          // JSON propio, sin input de usuario: no hay riesgo de inyección.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        {children}
      </body>
    </html>
  );
}
