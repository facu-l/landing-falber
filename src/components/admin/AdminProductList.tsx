import Image from "next/image";
import Link from "next/link";
import { adminProductPath } from "@/lib/admin/paths";
import {
  type AdminProductRow,
  groupProductsForAdmin,
  MISSING_LABELS,
  missingForPublish,
  variantSummaries,
} from "@/lib/admin/product-list";
import { productImageSrc } from "@/lib/catalog/images";
import { StatusBadge } from "./StatusBadge";

/**
 * Lista de productos del admin: No publicados arriba (piden algo), después Publicados.
 * Cada fila es un link a la ficha; lo que falta y el stock van en texto, sin colores
 * que haya que interpretar.
 */
export function AdminProductList({ products }: { products: AdminProductRow[] }) {
  if (products.length === 0) {
    return (
      <p className="text-body text-text-secondary">Todavía no hay productos. Cargá el primero con NUEVO PRODUCTO.</p>
    );
  }

  const { unpublished, published } = groupProductsForAdmin(products);
  return (
    <div className="flex flex-col gap-10">
      <ProductGroup id="no-publicados" title="No publicados" products={unpublished} />
      <ProductGroup id="publicados" title="Publicados" products={published} />
    </div>
  );
}

function ProductGroup({ id, title, products }: { id: string; title: string; products: AdminProductRow[] }) {
  if (products.length === 0) return null;
  const headingId = `productos-${id}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-label text-text-secondary uppercase">
        {title} ({products.length})
      </h2>
      <ul className="flex flex-col border-t border-border">
        {products.map((product) => (
          <li key={product.id} className="border-b border-border">
            <ProductRow product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductRow({ product }: { product: AdminProductRow }) {
  const published = product.status === "active";
  const details = [
    ...missingForPublish(product).map((missing) => MISSING_LABELS[missing]),
    ...variantSummaries(product.product_variants),
    ...(product.is_featured ? ["Destacado"] : []),
  ];

  return (
    <Link
      href={adminProductPath(product.id)}
      // -mx-3 px-3: el fondo del hover enmarca la fila sin desalinearla de los títulos.
      className="-mx-3 flex min-h-11 items-center gap-4 px-3 py-4 transition-colors duration-150 hover:bg-surface-raised"
    >
      <Thumbnail imagePath={product.image_path} />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body text-text">
            {product.brand} · {product.name}
          </span>
          <StatusBadge tone={published ? "active" : "action"}>{published ? "Publicado" : "No publicado"}</StatusBadge>
        </div>
        {details.length > 0 && <p className="text-body-sm text-text-muted">{details.join(" · ")}</p>}
      </div>
    </Link>
  );
}

/** 48 px, 4:5 como en la tienda. Decorativa (alt=""): el nombre ya está en la fila. */
function Thumbnail({ imagePath }: { imagePath: string | null }) {
  const src = productImageSrc(imagePath);

  return (
    <div className="relative h-15 w-12 shrink-0 overflow-hidden rounded-md bg-surface-overlay">
      {src ? (
        <Image src={src} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-center text-caption text-text-muted uppercase">
          Sin foto
        </span>
      )}
    </div>
  );
}
