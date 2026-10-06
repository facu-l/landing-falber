import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Helpers de test que leen la migración. Sirven para que un mapa de errores en TS
 * falle si la base empieza a levantar un código que el mapa no conoce.
 */

/** Códigos que levanta una función de la migración: `raise exception using message = 'CODIGO'`. */
export function codesRaisedBy(functionName: string): string[] {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0001_initial_schema.sql"), "utf8");
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  if (start === -1) throw new Error(`La migración no define public.${functionName}`);
  const body = sql.slice(start, sql.indexOf("$$;", start));
  return [...body.matchAll(/message = '([A-Z_]+)'/g)].map((m) => m[1]);
}
