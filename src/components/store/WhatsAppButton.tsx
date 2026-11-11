"use client";

import { trackEvent } from "@/lib/analytics/track";

type Props = {
  href: string;
  label: string;
  source: "checkout" | "encargo";
  className?: string;
};

/**
 * El clic acá es la conversión real del negocio (plan de SEO, Fase 2): abrir
 * WhatsApp con el pedido o el encargo ya armado, después de completar el form.
 * Mismo botón en "Detalle de tu compra" (checkout) y en la confirmación de /encargos.
 */
export function WhatsAppButton({ href, label, source, className }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => trackEvent("whatsapp_click", { source })}
    >
      {label}
    </a>
  );
}
