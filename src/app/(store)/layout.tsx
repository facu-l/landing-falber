import { SiteFooter } from "@/components/store/SiteFooter";
import { SiteHeader } from "@/components/store/SiteHeader";

/**
 * Layout de la tienda pública (tema Noir, heredado del <html data-theme="dark"> raíz).
 * Es un route group: el admin de la Fase 5 tendrá su propio layout sin este header.
 */
export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </>
  );
}
