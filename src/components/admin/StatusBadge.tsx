import { cn } from "@/lib/cn";

/*
 * Etiqueta de estado del admin (pedidos y encargos). Los tonos varían en luminosidad,
 * no solo en color (DESIGN.md → Accesibilidad): action = relleno oscuro (pide acción),
 * active = borde, closed = apagado.
 */
export type StatusTone = "action" | "active" | "closed";

export function StatusBadge({ tone, children }: { tone: StatusTone; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-1 text-caption uppercase",
        tone === "action" && "border-accent bg-accent text-on-accent",
        tone === "active" && "border-border-strong text-text",
        tone === "closed" && "border-border text-text-muted",
      )}
    >
      {children}
    </span>
  );
}
