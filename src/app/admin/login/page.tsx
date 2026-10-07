import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";
import { Button } from "@/components/ui/Button";
import { getAdminStatus } from "@/lib/admin/auth";
import { ADMIN_ORDERS_PATH } from "@/lib/admin/paths";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Ingresar" };

/**
 * Login del panel. Lo que muestra sale de la sesión, no de la URL:
 * - admin: va directo a los pedidos;
 * - logueado sin perfil de admin: "sin acceso" y la opción de salir (requireAdmin lo trae acá);
 * - sin sesión: el formulario.
 * La sesión es dato de la request: se lee dentro de <Suspense> (Cache Components).
 */
export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-10 px-4 py-16 md:py-24">
      <h1 className="text-h1 text-text uppercase">Panel</h1>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginGate />
      </Suspense>
    </div>
  );
}

async function LoginGate() {
  const access = await getAdminStatus();
  if (access.status === "admin") redirect(ADMIN_ORDERS_PATH);
  if (access.status === "forbidden") return <NoAccess email={access.user.email} />;
  return <LoginForm />;
}

function NoAccess({ email }: { email?: string }) {
  return (
    <div role="status" className="flex flex-col items-start gap-6">
      <p className="text-body text-text-secondary">
        {email ? `La cuenta ${email} no tiene acceso al panel.` : "Esta cuenta no tiene acceso al panel."} Salí e
        ingresá con la cuenta de administración.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Salir
        </Button>
      </form>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="h-13 w-full bg-surface-overlay" />
      <div className="h-13 w-full bg-surface-overlay" />
      <div className="h-12 w-full bg-surface-overlay" />
    </div>
  );
}
