import Link from "next/link";
import { type CatalogProduct, type VariantType, fromPrice, isSoldOut } from "@/lib/catalog/catalog";
import { cn } from "@/lib/cn";
import { formatARS } from "@/lib/format";
import { ProductImage } from "./ProductImage";

type ProductCardProps = {
  product: CatalogProduct;
  sizes: string;
  /** Si se pasa, el precio "desde" es de ese tipo (ej. la fila de decants). */
  priceType?: VariantType;
  className?: string;
};

/** Precio para la tarjeta: "Desde" solo si hay más de una presentación posible. */
export function priceLabel(product: CatalogProduct, type?: VariantType): string | null {
  const price = fromPrice(product, type);
  if (price === null) return null;
  const options = product.variants.filter((v) => !type || v.variantType === type);
  return options.length > 1 ? `Desde ${formatARS(price)}` : formatARS(price);
}

export function ProductCard({ product, sizes, priceType, className }: ProductCardProps) {
  const soldOut = isSoldOut(product);
  const price = priceLabel(product, priceType);

  return (
    <Link href={`/producto/${product.slug}`} className={cn("group flex flex-col gap-4", className)}>
      <ProductImage imagePath={product.imagePath} alt={`${product.brand} ${product.name}`} sizes={sizes} />
      <div className="flex flex-col gap-1">
        <p className="text-caption text-text-muted uppercase">{product.brand}</p>
        <h3 className="text-h3 text-text transition-colors duration-150 group-hover:text-accent-strong">
          {product.name}
        </h3>
        <p className="text-body-sm text-text-secondary">
          {soldOut ? <span className="text-text-muted">Agotado · {price}</span> : price}
        </p>
      </div>
    </Link>
  );
}
