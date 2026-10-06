// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseRequest } from "./schema";

const VARIANT = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";

const valid = {
  fullName: "  Ana Pérez ",
  whatsapp: "0221 15 555-1234",
  perfumeName: " The Most Wanted ",
  brand: "Azzaro",
  presentation: "Frasco 100 ml",
  note: "Si llega antes de fin de mes",
  variantId: VARIANT,
};

describe("parseRequest", () => {
  it("valida, recorta y normaliza el WhatsApp", () => {
    expect(parseRequest(valid)).toEqual({
      success: true,
      data: {
        fullName: "Ana Pérez",
        whatsapp: "+5492215551234",
        perfumeName: "The Most Wanted",
        brand: "Azzaro",
        presentation: "Frasco 100 ml",
        note: "Si llega antes de fin de mes",
        variantId: VARIANT,
      },
    });
  });

  it("encargo libre: los opcionales vacíos (o que no llegan) quedan en null", () => {
    const result = parseRequest({ fullName: "Ana Pérez", whatsapp: "2215551234", perfumeName: "Oud Wood", brand: "  " });
    expect(result).toMatchObject({
      success: true,
      data: { brand: null, presentation: null, note: null, variantId: null },
    });
  });

  it.each([
    ["fullName", { fullName: "A" }],
    ["fullName", { fullName: "a".repeat(81) }],
    ["whatsapp", { whatsapp: "555" }],
    ["perfumeName", { perfumeName: " x " }],
    ["perfumeName", { perfumeName: "p".repeat(121) }],
    ["brand", { brand: "m".repeat(61) }],
    ["presentation", { presentation: "p".repeat(61) }],
    ["note", { note: "n".repeat(101) }],
    ["variantId", { variantId: "no-es-un-uuid" }],
  ])("rechaza un %s inválido con un mensaje en ese campo", (field, override) => {
    const result = parseRequest({ ...valid, ...override });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors[field as keyof typeof result.fieldErrors]).toEqual(expect.any(String));
  });

  it("los límites son los de la base: 60 de marca y presentación, 100 de aclaración", () => {
    expect(parseRequest({ ...valid, brand: "m".repeat(60), presentation: "p".repeat(60), note: "n".repeat(100) }).success).toBe(true);
  });

  it("muestra todos los errores juntos, no de a uno", () => {
    const result = parseRequest({ ...valid, fullName: "", whatsapp: "1", perfumeName: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(result.fieldErrors).sort()).toEqual(["fullName", "perfumeName", "whatsapp"]);
  });
});
