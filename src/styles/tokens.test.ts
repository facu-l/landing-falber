// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardia contra el desfase entre el design system y el CSS:
// globals.css se sincroniza a mano con design/falber-tokens.json.

type ColorToken = { name: string; value: { dark: string; light: string } };

const root = process.cwd();
const tokens: { color: { tokens: ColorToken[] } } = JSON.parse(
  readFileSync(path.join(root, "design/falber-tokens.json"), "utf8"),
);
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

const BRAND_CONSTANTS = ["carbon-black", "graphite", "platinum"];

/** Devuelve el cuerpo del primer bloque cuyo selector termina en `selectorEnd {`. */
function blockBody(selectorEnd: string): string {
  const start = css.indexOf(`${selectorEnd} {`);
  if (start === -1) throw new Error(`No se encontró el bloque ${selectorEnd}`);
  return css.slice(start, css.indexOf("}", start));
}

function cssVar(body: string, name: string): string | undefined {
  const match = body.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim().toLowerCase();
}

const noir = blockBody('[data-theme="dark"]');
const platinum = blockBody('[data-theme="light"]');
const theme = blockBody("@theme inline");

describe("globals.css respeta design/falber-tokens.json", () => {
  const semantic = tokens.color.tokens.filter((t) => !BRAND_CONSTANTS.includes(t.name));
  const brand = tokens.color.tokens.filter((t) => BRAND_CONSTANTS.includes(t.name));

  it.each(semantic)("$name en Noir y Platinum", (token) => {
    expect(cssVar(noir, token.name)).toBe(token.value.dark.toLowerCase());
    expect(cssVar(platinum, token.name)).toBe(token.value.light.toLowerCase());
  });

  it.each(semantic)("$name está expuesto a Tailwind como color", (token) => {
    expect(cssVar(theme, `color-${token.name}`)).toBe(`var(--${token.name})`);
  });

  it.each(brand)("constante de marca $name", (token) => {
    expect(cssVar(theme, `color-${token.name}`)).toBe(token.value.dark.toLowerCase());
  });
});
