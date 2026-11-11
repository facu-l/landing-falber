declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara un evento de GA4 si gtag ya cargó (strategy="afterInteractive" puede tardar
 * más que el primer clic del visitante: en ese caso no hace nada, no rompe el flujo).
 */
export function trackEvent(name: string, params: Record<string, string> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
