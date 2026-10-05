// @vitest-environment node
import { describe, expect, it } from "vitest";
import { required } from "./env";

describe("required", () => {
  it("devuelve el valor cuando existe", () => {
    expect(required("X", "valor")).toBe("valor");
  });

  it.each([undefined, ""])("con %j falla nombrando la variable y cómo arreglarlo", (value) => {
    expect(() => required("SUPABASE_SERVICE_ROLE_KEY", value)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY.*\.env\.example/,
    );
  });
});
