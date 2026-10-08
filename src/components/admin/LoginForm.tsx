"use client";

import { useActionState, useState } from "react";
import { signIn } from "@/app/admin/login/actions";
import { TurnstileField } from "@/components/store/TurnstileField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INITIAL_LOGIN_STATE, type LoginState } from "@/lib/admin/login-state";
import { TURNSTILE_FIELD } from "@/lib/forms/form-data";

/**
 * Login del admin. Si sale bien, la acción redirige a los pedidos; si no, vuelve
 * el error y el email escrito (la contraseña nunca vuelve del servidor).
 * Con Turnstile: el token lo verifica Supabase Auth (CAPTCHA nativo, ver actions.ts).
 */
export function LoginForm() {
  const [serverErrors, setServerErrors] = useState(0);
  const [state, formAction, pending] = useActionState(async (prev: LoginState, formData: FormData) => {
    const next = await signIn(prev, formData);
    // Un token nuevo solo si el anterior llegó a Auth (cada uno sirve una vez). Si no se
    // mandó (el widget no terminó) o hubo errores por campo, resetear solo demora el token.
    const sentToken = Boolean(formData.get(TURNSTILE_FIELD));
    const failedAtAuth = next.status === "error" && !next.fieldErrors;
    if (sentToken && failedAtAuth) setServerErrors((key) => key + 1);
    return next;
  }, INITIAL_LOGIN_STATE);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const email = state.status === "error" ? state.values.email : undefined;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <Input
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        defaultValue={email}
        error={errors.email}
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors.password}
      />
      {state.status === "error" && state.message && (
        <p role="alert" className="text-body-sm text-error">
          {state.message}
        </p>
      )}
      <TurnstileField resetKey={serverErrors} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Ingresando" : "Ingresar"}
      </Button>
    </form>
  );
}
