"use client";

import { useActionState } from "react";
import { signIn } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { INITIAL_LOGIN_STATE } from "@/lib/admin/login-state";

/**
 * Login del admin. Si sale bien, la acción redirige a los pedidos; si no, vuelve
 * el error y el email escrito (la contraseña nunca vuelve del servidor).
 * Sin Turnstile: Supabase Auth limita los intentos (TODOS.md → Anti-abuso).
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL_LOGIN_STATE);
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
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Ingresando" : "Ingresar"}
      </Button>
    </form>
  );
}
