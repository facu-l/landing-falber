import { describe, expect, it } from "vitest";
import { missingForPublishText, PRODUCT_DATA_ERRORS, parseProductData } from "./product-data";
import { NEW_PRODUCT_ERRORS } from "./product-list";

describe("parseProductData", () => {
  it("recorta y convierte: género vacío y descripción vacía son null; destacado es el checkbox", () => {
    expect(parseProductData({ brand: " Dior ", name: " Sauvage EDT ", gender: "", description: "  ", featured: "on" })).toEqual({
      success: true,
      data: { brand: "Dior", name: "Sauvage EDT", gender: null, description: null, is_featured: true },
    });
  });

  it("un checkbox sin tildar no viaja en el form: no destacado", () => {
    expect(parseProductData({ brand: "Dior", name: "Sauvage", gender: "male", description: "Fresco." })).toMatchObject({
      data: { gender: "male", description: "Fresco.", is_featured: false },
    });
  });

  it("solo el valor del checkbox tildado (on) destaca: otro texto armado a mano no", () => {
    for (const featured of ["false", "0", "off", ""]) {
      expect(parseProductData({ brand: "Dior", name: "Sauvage", featured }), featured).toMatchObject({
        data: { is_featured: false },
      });
    }
  });

  it("valida marca y nombre igual que el alta", () => {
    expect(parseProductData({ brand: "", name: "S" })).toEqual({
      success: false,
      fieldErrors: { brand: NEW_PRODUCT_ERRORS.brandRequired, name: NEW_PRODUCT_ERRORS.nameLength },
    });
  });

  it("la descripción llega hasta 1000 caracteres (check de 0005), contados después de recortar", () => {
    expect(parseProductData({ brand: "Dior", name: "Sauvage", description: ` ${"d".repeat(1000)} ` }).success).toBe(true);
    expect(parseProductData({ brand: "Dior", name: "Sauvage", description: "d".repeat(1001) })).toEqual({
      success: false,
      fieldErrors: { description: PRODUCT_DATA_ERRORS.descriptionLength },
    });
  });

  it("un género fuera de la lista se rechaza", () => {
    expect(parseProductData({ brand: "Dior", name: "Sauvage", gender: "otro" })).toEqual({
      success: false,
      fieldErrors: { gender: PRODUCT_DATA_ERRORS.gender },
    });
  });

  it("no lee el slug: el link no cambia al corregir el nombre (SLUG_LOCKED)", () => {
    const parsed = parseProductData({ brand: "Dior", name: "Sauvage", slug: "otro" });
    expect(parsed.success && "slug" in parsed.data).toBe(false);
  });
});

describe("missingForPublishText", () => {
  it("vacío si no falta nada", () => {
    expect(missingForPublishText([])).toBeNull();
  });

  it("lista lo que falta en el orden del checklist", () => {
    expect(missingForPublishText(["image", "variant"])).toBe("Para publicar falta: foto · una presentación disponible");
    expect(missingForPublishText(["variant"])).toBe("Para publicar falta: una presentación disponible");
  });
});
