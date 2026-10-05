import type { Metadata } from "next";
import { Cinzel, Montserrat } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "FALBER · Fragrance experience",
    template: "%s · FALBER",
  },
  description: "Decants y perfumes FALBER. Fragrance experience.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      data-theme="dark"
      className={`${cinzel.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
