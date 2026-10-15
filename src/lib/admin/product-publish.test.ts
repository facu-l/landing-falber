// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseTargetStatus, PUBLISH_ERRORS, publishErrorMessage } from "./product-publish";

describe("parseTargetStatus", () => {
  it("acepta solo publicar u ocultar", () => {
    expect(parseTargetStatus("active")).toBe("active");
    expect(parseTargetStatus("inactive")).toBe("inactive");
    for (const value of ["", "archived", "toString", undefined]) {
      expect(parseTargetStatus(value)).toBeNull();
    }
  });
});

describe("publishErrorMessage (PRODUCT_NOT_PUBLISHABLE de 0003)", () => {
  it("dice qué falta según el detail de la base", () => {
    expect(publishErrorMessage({ message: "PRODUCT_NOT_PUBLISHABLE", details: "image" })).toEqual({
      known: true,
      message: PUBLISH_ERRORS.image,
    });
    expect(publishErrorMessage({ message: "PRODUCT_NOT_PUBLISHABLE", details: "variant" })).toEqual({
      known: true,
      message: PUBLISH_ERRORS.variant,
    });
  });

  it("un detail desconocido sigue siendo el código nuestro, con un mensaje general", () => {
    expect(publishErrorMessage({ message: "PRODUCT_NOT_PUBLISHABLE", details: "otra" })).toEqual({
      known: true,
      message: PUBLISH_ERRORS.notPublishable,
    });
  });

  it("otro error no es nuestro: pide reintentar y hay que loguearlo", () => {
    expect(publishErrorMessage({ code: "08006", message: "connection" })).toEqual({
      known: false,
      message: PUBLISH_ERRORS.save,
    });
  });
});
