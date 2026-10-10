import Link from "next/link";

// min-h-11: área táctil de 44 px; reemplaza el gap entre links. El -mt-3 de cada columna
// compensa el aire de la caja para que el primer renglón siga alineado con FALBER.
const linkClasses =
  "inline-flex min-h-11 items-center text-body-sm text-text-secondary transition-colors duration-150 hover:text-text";

// Íconos de línea dibujados a mano, con el trazo del carrito (CartLink): sin librería
// de íconos por tres logos. currentColor los hace seguir el color del link en hover.
const SOCIAL_LINKS = [
  {
    network: "Instagram",
    label: "@falber.parfum",
    href: "https://www.instagram.com/falber.parfum/",
    icon: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.25" cy="6.75" r="0.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    network: "TikTok",
    label: "@falber.perfume",
    href: "https://www.tiktok.com/@falber.perfume",
    icon: (
      <>
        <path d="M13.5 3.5v11.25a3.75 3.75 0 1 1-3.75-3.75" />
        <path d="M13.5 3.5c.4 2.6 2.4 4.6 5 4.9" />
      </>
    ),
  },
  {
    network: "Facebook",
    // La página no tiene usuario (@): la URL es por id.
    label: "FALBER",
    href: "https://www.facebook.com/profile.php?id=61595043872733",
    icon: (
      <>
        <path d="M15.5 3.5h-2a3.5 3.5 0 0 0-3.5 3.5v13.5" />
        <path d="M7 10.5h8" />
      </>
    ),
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[2fr_1fr_1fr] md:px-8">
        <div className="flex flex-col gap-3">
          <p className="font-display text-wordmark-serif text-platinum uppercase">FALBER</p>
          <p className="text-body-sm text-text-muted">Fragrance experience</p>
        </div>

        <nav aria-label="Tienda" className="-mt-3 flex flex-col">
          <Link href="/catalogo" className={linkClasses}>
            Catálogo
          </Link>
          <Link href="/catalogo?tipo=decant" className={linkClasses}>
            Decants
          </Link>
          <Link href="/catalogo?tipo=full_bottle" className={linkClasses}>
            Frascos
          </Link>
        </nav>

        <div className="-mt-3 flex flex-col">
          <nav aria-label="Redes sociales" className="flex flex-col">
            {SOCIAL_LINKS.map(({ network, label, href, icon }) => (
              <a
                key={network}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${network} ${label}`}
                className={`${linkClasses} gap-3`}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5 shrink-0"
                >
                  {icon}
                </svg>
                {label}
              </a>
            ))}
          </nav>
          <p className="mt-3 text-body-sm text-text-muted">Retiro en La Plata</p>
        </div>
      </div>

      {/* Año fijo: es el de la primera publicación. Con Cache Components, new Date()
          haría dinámica cada página por un número que cambia una vez por año. */}
      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-4 py-6 text-caption text-text-muted md:px-8">
          © 2026 FALBER. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
