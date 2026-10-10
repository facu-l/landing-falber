import Link from "next/link";

// min-h-11: área táctil de 44 px; reemplaza el gap entre links. El -mt-3 de cada columna
// compensa el aire de la caja para que el primer renglón siga alineado con FALBER.
const linkClasses =
  "inline-flex min-h-11 items-center text-body-sm text-text-secondary transition-colors duration-150 hover:text-text";

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
          <a
            href="https://www.instagram.com/falber.parfum/"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClasses}
          >
            @falber.parfum
          </a>
          <p className="text-body-sm text-text-muted">Retiro en La Plata</p>
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
