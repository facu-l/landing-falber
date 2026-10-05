import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function StoreNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-24 md:px-8">
      <h1 className="text-h1 text-text uppercase">No encontramos esta página</h1>
      <p className="max-w-[48ch] text-body text-text-secondary">
        Puede que el producto ya no esté en el catálogo o que el link tenga un error.
      </p>
      <Link href="/catalogo" className={buttonClasses("primary")}>
        Ver catálogo
      </Link>
    </div>
  );
}
