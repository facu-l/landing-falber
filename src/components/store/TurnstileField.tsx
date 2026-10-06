"use client";

import { useCallback, useState } from "react";
import { TURNSTILE_FIELD } from "@/lib/forms/form-data";
import { Turnstile } from "./Turnstile";

/*
 * Turnstile listo para un formulario: guarda el token en estado y lo manda en su
 * propio input oculto (decisión 38). El formulario solo cambia resetKey después de
 * cada error del servidor: el token ya se usó y hace falta uno nuevo.
 */
export function TurnstileField({ resetKey }: { resetKey: number }) {
  const [token, setToken] = useState<string | null>(null);
  const handleToken = useCallback((value: string | null) => setToken(value), []);

  return (
    <>
      <input type="hidden" name={TURNSTILE_FIELD} value={token ?? ""} />
      <Turnstile onToken={handleToken} resetKey={resetKey} />
    </>
  );
}
