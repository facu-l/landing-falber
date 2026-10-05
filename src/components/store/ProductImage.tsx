import Image from "next/image";
import { productImageSrc } from "@/lib/catalog/images";
import { cn } from "@/lib/cn";

type ProductImageProps = {
  imagePath: string | null;
  alt: string;
  /** Atributo sizes de next/image: cuánto ocupa la foto en cada ancho de pantalla. */
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** Foto 4:5 sobre graphite con radius-md (DESIGN.md → Fotos de producto). */
export function ProductImage({ imagePath, alt, sizes, priority = false, className }: ProductImageProps) {
  const src = productImageSrc(imagePath);

  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-md bg-surface-raised", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-[filter] duration-300 group-hover:brightness-125"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-caption text-text-muted uppercase">Foto en preparación</span>
        </div>
      )}
    </div>
  );
}
