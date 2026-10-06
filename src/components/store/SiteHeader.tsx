import Link from "next/link";
import { CartLink } from "./CartLink";

const linkClasses =
  "text-label uppercase text-text-secondary transition-colors duration-150 hover:text-text";

/** Header de la tienda: wordmark tipográfico (no hay logo vectorial, ver DESIGN.md → Logos). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:h-[72px] md:px-8">
        <Link href="/" aria-label="FALBER, inicio" className="text-wordmark text-platinum uppercase">
          FALBER
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-5 md:gap-10">
          <Link href="/catalogo?tipo=decant" className={`${linkClasses} hidden md:inline`}>
            Decants
          </Link>
          <Link href="/catalogo?tipo=full_bottle" className={`${linkClasses} hidden md:inline`}>
            Frascos
          </Link>
          <Link href="/catalogo" className={linkClasses}>
            Catálogo
          </Link>
          <CartLink className={linkClasses} />
        </nav>
      </div>
    </header>
  );
}
