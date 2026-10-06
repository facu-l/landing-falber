// @vitest-environment node
import { describe, expect, it } from "vitest";
import { codesRaisedBy } from "@/test/migration";
import { GENERIC_REQUEST_ERROR, REQUEST_ERRORS, requestError } from "./errors";

describe("REQUEST_ERRORS", () => {
  // create_perfume_request llama a enforce_rate_limit: sus errores también llegan a /encargos.
  const raised = [...codesRaisedBy("create_perfume_request"), ...codesRaisedBy("enforce_rate_limit")];

  it("lee los códigos de la migración (si no, el test de abajo no prueba nada)", () => {
    expect(raised).toContain("INVALID_PERFUME_NAME");
    expect(raised).toContain("RATE_LIMITED");
  });

  it.each([...new Set(raised)])("tiene un mensaje para %s", (code) => {
    expect(REQUEST_ERRORS[code as keyof typeof REQUEST_ERRORS]).toBeTruthy();
  });

  it("los mensajes respetan la voz de la marca: sin signos de exclamación ni emojis", () => {
    for (const message of [...Object.values(REQUEST_ERRORS), GENERIC_REQUEST_ERROR]) {
      expect(message).not.toMatch(/[!¡]|\p{Extended_Pictographic}/u);
      expect(message).toMatch(/\.$/);
    }
  });
});

describe("requestError", () => {
  it("traduce el código que manda la base", () => {
    expect(requestError({ message: "VARIANT_NOT_FOUND", details: "abc", code: "P0001" })).toEqual({
      code: "VARIANT_NOT_FOUND",
      message: REQUEST_ERRORS.VARIANT_NOT_FOUND,
      known: true,
    });
  });

  it("con un error que no es nuestro devuelve el mensaje genérico y lo marca como desconocido", () => {
    expect(requestError({ message: "boom", code: "23514" })).toEqual({
      code: "UNKNOWN",
      message: GENERIC_REQUEST_ERROR,
      known: false,
    });
  });
});
