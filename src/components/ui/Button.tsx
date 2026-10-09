import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary";

// min-h-11: el padding y la línea del label suman 42 px; el área táctil mínima es 44.
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-none px-6 py-3 " +
  "text-label uppercase transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent border border-accent " +
    "hover:bg-accent-strong hover:border-accent-strong",
  secondary:
    "bg-transparent text-text border border-border-strong " +
    "hover:border-accent hover:text-accent-strong",
};

/**
 * Clases del botón, para reusarlas en un <Link> que se ve como botón:
 *   <Link href="/catalogo" className={buttonClasses("secondary")}>Ver catálogo</Link>
 */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
};

/**
 * Acción principal de FALBER: label en mayúsculas con tracking amplio, esquinas rectas.
 * type="button" por defecto: un <button> sin type dentro de un form lo envía.
 * Para enviar un formulario, pasar type="submit" explícitamente.
 */
export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
