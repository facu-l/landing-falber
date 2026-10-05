"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

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
  onToken: (token: string | null) => void;
  resetKey: number;
};

export function Turnstile({ onToken, resetKey }: TurnstileProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!scriptReady || !siteKey || !container.current || !window.turnstile) return;

    const id = window.turnstile.render(container.current, {
      sitekey: siteKey,
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
  }, [scriptReady, siteKey, onToken]);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current) return;
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
