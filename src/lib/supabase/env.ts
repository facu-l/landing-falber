/**
 * Variables públicas de Supabase (seguras en el navegador: RLS protege los datos).
 *
 * Se leen con el nombre literal (process.env.NEXT_PUBLIC_...) porque Next.js
 * solo incrusta en el bundle del cliente los accesos escritos así.
 */
export function supabasePublicEnv() {
  return {
    url: supabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

/**
 * La URL base del proyecto, sin path. El cliente agrega el de cada servicio
 * (/rest/v1, /auth/v1): con /rest/v1 pegado, el build falla con
 * "Invalid path specified in request URL", un error que no dice qué variable revisar.
 */
export function supabaseUrl(value: string | undefined): string {
  const name = "NEXT_PUBLIC_SUPABASE_URL";
  const url = required(name, value);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${name} no es una URL válida. Ejemplo: https://<ref>.supabase.co`);
  }
  // Query y fragmento también rompen las URLs que arma el cliente.
  const extra = `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}${parsed.hash}`;
  if (extra) {
    throw new Error(`${name} tiene que ser la URL base, sin path (sacá "${extra}").`);
  }
  return url;
}

export function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Copiá .env.example a .env.local.`);
  }
  return value;
}
