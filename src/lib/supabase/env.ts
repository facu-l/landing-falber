/**
 * Variables públicas de Supabase (seguras en el navegador: RLS protege los datos).
 *
 * Se leen con el nombre literal (process.env.NEXT_PUBLIC_...) porque Next.js
 * solo incrusta en el bundle del cliente los accesos escritos así.
 */
export function supabasePublicEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Copiá .env.example a .env.local.`);
  }
  return value;
}
