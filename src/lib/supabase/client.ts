import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabasePublicEnv } from "./env";

/** Cliente para componentes del navegador ("use client"). Sujeto a RLS. */
export function createClient() {
  const { url, publishableKey } = supabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
