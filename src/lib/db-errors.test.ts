// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mapDbError } from "./db-errors";

const MESSAGES = { RATE_LIMITED: "Demasiados intentos.", NOT_FOUND: "No existe." } as const;
const FALLBACK = "Algo falló.";

describe("mapDbError", () => {
  it("traduce el código que manda la base y conserva el detail", () => {
    expect(mapDbError({ message: "NOT_FOUND", details: "abc", code: "P0001" }, MESSAGES, FALLBACK)).toEqual({
      code: "NOT_FOUND",
      message: MESSAGES.NOT_FOUND,
      detail: "abc",
      known: true,
    });
  });

  it("sin detail devuelve null", () => {
    expect(mapDbError({ message: "RATE_LIMITED" }, MESSAGES, FALLBACK).detail).toBeNull();
  });

  it.each([
    ["un código que no está en el mapa", { message: "SOMETHING_NEW" }],
    ["una violación de constraint (23514)", { message: 'new row violates check constraint "x"', code: "23514" }],
    ["un error sin mensaje", {}],
    // Object.hasOwn: una propiedad heredada de Object no cuenta como código conocido.
    ["un nombre heredado de Object", { message: "toString" }],
  ])("con %s devuelve el mensaje genérico y lo marca como desconocido", (_, error) => {
    expect(mapDbError(error, MESSAGES, FALLBACK)).toEqual({
      code: "UNKNOWN",
      message: FALLBACK,
      detail: null,
      known: false,
    });
  });
});
