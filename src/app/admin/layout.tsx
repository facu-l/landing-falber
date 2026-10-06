import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · FALBER" },
  // El panel no se indexa (igual está detrás del login).
  robots: { index: false, follow: false },
};

/**
 * Layout del panel /admin: tema Platinum (DESIGN.md → Temas en la app).
 * El <html> raíz fija data-theme="dark" para la tienda; los tokens son variables CSS,
 * así que este contenedor con data-theme="light" los redefine para todo lo de adentro.
 * Sin layouts raíz separados: saltar entre tienda y admin no recarga la página.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div data-theme="light" className="flex flex-1 flex-col bg-surface text-text">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 md:px-8">
          {/* Sobre fondo claro, texto y no platino (DESIGN.md → Regla del platino). */}
          <span className="text-wordmark text-text uppercase">FALBER</span>
          <span className="text-label text-text-muted uppercase">Admin</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
