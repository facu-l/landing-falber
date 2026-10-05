import Link from "next/link";

const linkClasses = "text-body-sm text-text-secondary transition-colors duration-150 hover:text-text";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[2fr_1fr_1fr] md:px-8">
        <div className="flex flex-col gap-3">
          <p className="font-display text-wordmark-serif text-platinum uppercase">FALBER</p>
          <p className="text-body-sm text-text-muted">Fragrance experience</p>
        </div>

        <nav aria-label="Tienda" className="flex flex-col gap-3">
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

        <div className="flex flex-col gap-3">
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
    </footer>
  );
}
