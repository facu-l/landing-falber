// @vitest-environment node
import { expect, it } from "vitest";
import { formatARS } from "./format";

it("formatARS usa separador de miles argentino y sin centavos", () => {
  expect(formatARS(14500)).toBe("$ 14.500");
  expect(formatARS(245000.4)).toBe("$ 245.000");
});
