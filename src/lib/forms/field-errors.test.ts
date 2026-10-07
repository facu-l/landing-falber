// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { firstFieldErrors } from "./field-errors";

const schema = z.object({
  name: z.string().min(2, "Muy corto.").max(3, "Muy largo."),
  email: z.email("Email inválido."),
});

const issues = (input: unknown) => schema.safeParse(input).error?.issues ?? [];

describe("firstFieldErrors", () => {
  it("deja un mensaje por campo: el primero", () => {
    expect(firstFieldErrors(issues({ name: "", email: "x" }))).toEqual({ name: "Muy corto.", email: "Email inválido." });
  });

  it("no pisa un error que ya estaba (ej. una regla entre campos del checkout)", () => {
    expect(firstFieldErrors(issues({ name: "", email: "x" }), { email: "Ya existe." })).toEqual({
      name: "Muy corto.",
      email: "Ya existe.",
    });
  });

  it("sin issues devuelve lo que ya había", () => {
    expect(firstFieldErrors([], { name: "Otro error." })).toEqual({ name: "Otro error." });
  });
});
