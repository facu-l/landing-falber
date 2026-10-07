// @vitest-environment node
import { expect, it } from "vitest";
import { formatARS, formatDateTime } from "./format";

it("formatDateTime muestra la hora de Argentina aunque el servidor corra en UTC", () => {
  // 00:30 UTC del 7 = 21:30 del 6 en Buenos Aires (UTC-3).
  expect(formatDateTime("2026-10-07T00:30:00Z")).toBe("06/10 21:30");
});

it("formatARS usa separador de miles argentino y sin centavos", () => {
  expect(formatARS(14500)).toBe("$ 14.500");
  expect(formatARS(245000.4)).toBe("$ 245.000");
});
