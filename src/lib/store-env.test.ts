// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseWhatsAppNumber } from "./store-env";

describe("parseWhatsAppNumber", () => {
  it("acepta el formato de wa.me: 549 + área + número, sin 0 ni 15", () => {
    expect(parseWhatsAppNumber("5492355481449")).toBe("5492355481449");
  });

  it("falla si falta, nombrando la variable", () => {
    expect(() => parseWhatsAppNumber(undefined)).toThrow(/NEXT_PUBLIC_WHATSAPP_NUMBER.*\.env\.example/);
  });

  it.each([
    ["con +", "+5492355481449"],
    ["con espacios", "549 2355 481449"],
    ["sin el 9", "542355481449"],
    ["con el 0 del área", "54902355481449"],
    ["con el 15", "549235515481449"],
    ["número local", "2355481449"],
  ])("rechaza un número %s", (_, value) => {
    expect(() => parseWhatsAppNumber(value)).toThrow(/NEXT_PUBLIC_WHATSAPP_NUMBER/);
  });
});
