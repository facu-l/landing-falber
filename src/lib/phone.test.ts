// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeArgentineWhatsApp } from "./phone";

describe("normalizeArgentineWhatsApp", () => {
  it.each([
    // Como lo escribe la gente: con 0 y 15
    ["0221 15 555-1234", "+5492215551234"],
    ["011 15 1234-5678", "+5491112345678"],
    ["02355 15 48-1449", "+5492355481449"],
    ["0351 15-555-1234", "+5493515551234"],
    ["(0221) 15 5551234", "+5492215551234"],
    // Sin el 0 o sin el 15
    ["221 15 555 1234", "+5492215551234"],
    ["0221 555 1234", "+5492215551234"],
    ["2215551234", "+5492215551234"],
    ["11 1234 5678", "+5491112345678"],
    // Con el código de país, con o sin el 9 (y hasta con el 15, que sobra)
    ["+54 9 221 555-1234", "+5492215551234"],
    ["+54 221 555 1234", "+5492215551234"],
    ["5492355481449", "+5492355481449"],
    ["+54 9 221 15 555 1234", "+5492215551234"],
    ["  +54.9.11.1234.5678  ", "+5491112345678"],
    ["+54 9 0221 555 1234", "+5492215551234"],
  ])("%j → %s", (input, expected) => {
    expect(normalizeArgentineWhatsApp(input)).toBe(expected);
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["con letras", "221 555 abcd"],
    ["sin código de área", "555-1234"],
    ["15 sin código de área", "15 555 1234"],
    ["corto", "221 555 123"],
    ["largo", "0221 15 555 12345"],
    ["de otro país", "+1 202 555 0123"],
    ["con un área imposible (empieza con 5)", "0521 555 1234"],
  ])("rechaza un número %s", (_, input) => {
    expect(normalizeArgentineWhatsApp(input)).toBeNull();
  });
});
