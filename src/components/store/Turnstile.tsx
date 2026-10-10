"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { TurnstileAction } from "@/lib/forms/form-data";

/*
 * Widget de Cloudflare Turnstile con render explícito: el formulario se monta en el
 * cliente después de leer el carrito, cuando el render implícito ya escaneó la página.
 *
 * "response-field": false → el widget no agrega su input oculto; el token llega por
 * onToken y el formulario lo manda en su propio input. Así el formulario se puede
 * testear sin el script de Cloudflare.
 *
 * Cada token sirve una sola vez: el formulario cambia resetKey después de cada error
 * del servidor para pedir uno nuevo.
 */

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileProps = {
  /** Va en el token: el servidor exige la misma acción (decisión 87). */
  action: TurnstileAction;
  onToken: (token: string | null) => void;
  resetKey: number;
};

export function Turnstile({ action, onToken, resetKey }: TurnstileProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // Último resetKey aplicado. Un widget recién montado (o vuelto a mostrar por Activity)
  // ya trae un token nuevo: solo hay que resetear cuando el resetKey cambia.
  const appliedResetKey = useRef(resetKey);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!scriptReady || !siteKey || !container.current || !window.turnstile) return;

    const id = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      "response-field": false,
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    widgetId.current = id;

    return () => {
      window.turnstile?.remove(id);
      widgetId.current = null;
    };
  }, [scriptReady, siteKey, action, onToken]);

  useEffect(() => {
    if (resetKey === appliedResetKey.current || !widgetId.current) return;
    appliedResetKey.current = resetKey;
    onToken(null);
    window.turnstile?.reset(widgetId.current);
  }, [resetKey, onToken]);

  return (
    <>
      <Script src={SCRIPT_URL} strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={container} />
    </>
  );
}
