// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertLocalSupabase } from "./local-users";

describe("assertLocalSupabase", () => {
  it("acepta el Supabase local (CLI y CI)", () => {
    expect(() => assertLocalSupabase("http://127.0.0.1:54321")).not.toThrow();
    expect(() => assertLocalSupabase("http://localhost:54321/")).not.toThrow();
  });

  it("rechaza cualquier otro host: nunca crea usuarios en la nube", () => {
    expect(() => assertLocalSupabase("https://abcd.supabase.co")).toThrow(/solo contra Supabase local/);
    expect(() => assertLocalSupabase("http://localhost.evil.com:54321")).toThrow(/solo contra Supabase local/);
  });

  it("rechaza una URL vacía o inválida", () => {
    expect(() => assertLocalSupabase(undefined)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => assertLocalSupabase("no es una url")).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
