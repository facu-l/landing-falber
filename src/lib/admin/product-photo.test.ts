import { describe, expect, it } from "vitest";
import { buildPhotoPath, fitWithin, isPhotoPathFor, PHOTO_MAX_SIDE, photoExtension } from "./product-photo";

describe("photoExtension", () => {
  it("solo WebP y JPEG, como el bucket", () => {
    expect(photoExtension("image/webp")).toBe("webp");
    expect(photoExtension("image/jpeg")).toBe("jpg");
    expect(photoExtension("image/png")).toBeNull();
    expect(photoExtension("")).toBeNull();
  });
});

describe("buildPhotoPath", () => {
  it("es <slug>-<12 caracteres al azar>.<ext>", () => {
    expect(buildPhotoPath("dior-sauvage-edt", "webp", "0123456789ab")).toBe("dior-sauvage-edt-0123456789ab.webp");
  });

  it("sin random dado, genera uno distinto cada vez (la caché no muestra la foto vieja)", () => {
    const first = buildPhotoPath("dior-sauvage-edt", "jpg");
    const second = buildPhotoPath("dior-sauvage-edt", "jpg");
    expect(first).not.toBe(second);
    expect(isPhotoPathFor(first, "dior-sauvage-edt")).toBe(true);
  });
});

describe("isPhotoPathFor (D6: no se confía en la ruta del navegador)", () => {
  const slug = "dior-sauvage";

  it("acepta la forma que arma el servidor", () => {
    expect(isPhotoPathFor("dior-sauvage-0123456789ab.webp", slug)).toBe(true);
    expect(isPhotoPathFor("dior-sauvage-0123456789ab.jpg", slug)).toBe(true);
  });

  it("rechaza la foto de otro producto, aunque su slug empiece igual", () => {
    expect(isPhotoPathFor("creed-aventus-0123456789ab.webp", slug)).toBe(false);
    expect(isPhotoPathFor("dior-sauvage-edt-0123456789ab.webp", slug)).toBe(false);
  });

  it("rechaza otra extensión, otro largo, carpetas y nombres armados a mano", () => {
    for (const path of [
      "dior-sauvage-0123456789ab.png",
      "dior-sauvage-0123456789.webp",
      "dior-sauvage-0123456789ABC.webp",
      "otra/dior-sauvage-0123456789ab.webp",
      "../dior-sauvage-0123456789ab.webp",
      "dior-sauvage.webp",
      "",
    ]) {
      expect(isPhotoPathFor(path, slug), path).toBe(false);
    }
  });
});

describe("fitWithin", () => {
  it("achica el lado mayor a 1600 px manteniendo la proporción", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: PHOTO_MAX_SIDE, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: PHOTO_MAX_SIDE });
  });

  it("una foto chica no se agranda", () => {
    expect(fitWithin(800, 1000)).toEqual({ width: 800, height: 1000 });
  });

  it("redondea a píxeles enteros y nunca da 0", () => {
    expect(fitWithin(4801, 1)).toEqual({ width: PHOTO_MAX_SIDE, height: 1 });
    expect(fitWithin(3333, 2222)).toEqual({ width: 1600, height: 1067 });
  });
});
