// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BOTTLE_SIZE_MAX_ML,
  decantOptions,
  isDuplicateVariantError,
  nextFreeDecantSize,
  orderVariantsForAdmin,
  parseNewVariant,
  parseVariantEdit,
  parseVariantPrice,
  VARIANT_ERRORS,
  VARIANT_PRICE_MAX,
  variantCreatedWithoutStock,
  variantStockText,
} from "./product-variants";
import { STOCK_QUANTITY_MAX } from "./stock-movements";

const decant = (size_ml: number) => ({ variant_type: "decant" as const, size_ml });
const bottle = (size_ml: number) => ({ variant_type: "full_bottle" as const, size_ml });

describe("parseVariantPrice", () => {
  it("acepta pesos enteros", () => {
    expect(parseVariantPrice("12.000")).toEqual({ success: true, value: 12000 });
    expect(parseVariantPrice("$ 950")).toEqual({ success: true, value: 950 });
  });

  it("pide el precio y frena el 0 y un cero de más", () => {
    expect(parseVariantPrice("")).toEqual({ success: false, error: VARIANT_ERRORS.priceRequired });
    expect(parseVariantPrice("0")).toEqual({ success: false, error: VARIANT_ERRORS.priceZero });
    expect(parseVariantPrice("12,50")).toEqual({ success: false, error: VARIANT_ERRORS.priceFormat });
    expect(parseVariantPrice(String(VARIANT_PRICE_MAX + 1))).toEqual({ success: false, error: VARIANT_ERRORS.priceTooHigh });
    expect(parseVariantPrice(String(VARIANT_PRICE_MAX))).toEqual({ success: true, value: VARIANT_PRICE_MAX });
  });
});

describe("decantOptions y nextFreeDecantSize", () => {
  it("ofrece 3, 5 y 10 ml y deshabilita los que ya están", () => {
    expect(decantOptions([decant(5), bottle(3)])).toEqual([
      { sizeMl: 3, label: "3 ml", disabled: false },
      { sizeMl: 5, label: "5 ml (ya está)", disabled: true },
      { sizeMl: 10, label: "10 ml", disabled: false },
    ]);
  });

  it("preselecciona el primer tamaño libre (un frasco de 3 ml no ocupa el decant)", () => {
    expect(nextFreeDecantSize([])).toBe(3);
    expect(nextFreeDecantSize([decant(3), bottle(5)])).toBe(5);
    expect(nextFreeDecantSize([decant(3), decant(5), decant(10)])).toBeNull();
  });
});

describe("parseNewVariant", () => {
  const values = (v: Record<string, string>) => ({ variantType: "decant", sizeMl: "5", price: "12.000", initialStock: "", ...v });

  it("arma un decant con stock inicial vacío = 0", () => {
    expect(parseNewVariant(values({}), [])).toEqual({
      success: true,
      data: { variantType: "decant", sizeMl: 5, price: 12000, initialStock: 0 },
    });
  });

  it("arma un frasco con los ml a mano y stock inicial", () => {
    expect(parseNewVariant(values({ variantType: "full_bottle", sizeMl: "100", initialStock: "2" }), [decant(5)])).toEqual({
      success: true,
      data: { variantType: "full_bottle", sizeMl: 100, price: 12000, initialStock: 2 },
    });
  });

  it("rechaza un tipo que no es decant ni frasco", () => {
    for (const variantType of ["", "sample", "toString"]) {
      expect(parseNewVariant(values({ variantType }), [])).toMatchObject({
        success: false,
        fieldErrors: { variantType: VARIANT_ERRORS.type },
      });
    }
  });

  it("un decant solo puede ser de 3, 5 o 10 ml", () => {
    for (const sizeMl of ["", "7", "abc"]) {
      expect(parseNewVariant(values({ sizeMl }), [])).toMatchObject({ fieldErrors: { sizeMl: VARIANT_ERRORS.decantSize } });
    }
  });

  it("un frasco necesita ml enteros, mayores a 0 y con tope", () => {
    const asBottle = (sizeMl: string) => parseNewVariant(values({ variantType: "full_bottle", sizeMl }), []);
    for (const sizeMl of ["", "0", "100,5", "-50"]) {
      expect(asBottle(sizeMl)).toMatchObject({ fieldErrors: { sizeMl: VARIANT_ERRORS.bottleSize } });
    }
    expect(asBottle(String(BOTTLE_SIZE_MAX_ML + 1))).toMatchObject({ fieldErrors: { sizeMl: VARIANT_ERRORS.bottleSizeTooHigh } });
    expect(asBottle(String(BOTTLE_SIZE_MAX_ML))).toMatchObject({ success: true });
  });

  it("avisa si la presentación ya existe (el unique de la base es la red)", () => {
    expect(parseNewVariant(values({}), [decant(5)])).toMatchObject({ fieldErrors: { sizeMl: VARIANT_ERRORS.duplicate } });
    expect(parseNewVariant(values({ variantType: "full_bottle", sizeMl: "5" }), [decant(5)])).toMatchObject({ success: true });
  });

  it("el stock inicial es opcional, entero y con el tope de Mover stock", () => {
    expect(parseNewVariant(values({ initialStock: "1.5" }), [])).toMatchObject({ fieldErrors: { initialStock: VARIANT_ERRORS.initialStock } });
    expect(parseNewVariant(values({ initialStock: String(STOCK_QUANTITY_MAX + 1) }), [])).toMatchObject({
      fieldErrors: { initialStock: VARIANT_ERRORS.initialStockTooHigh },
    });
    expect(parseNewVariant(values({ initialStock: "0" }), [])).toMatchObject({ data: { initialStock: 0 } });
  });

  it("junta los errores de todos los campos", () => {
    expect(parseNewVariant({ variantType: "decant", sizeMl: "7", price: "", initialStock: "x" }, [])).toEqual({
      success: false,
      fieldErrors: {
        sizeMl: VARIANT_ERRORS.decantSize,
        price: VARIANT_ERRORS.priceRequired,
        initialStock: VARIANT_ERRORS.initialStock,
      },
    });
  });
});

describe("parseVariantEdit", () => {
  it("lee precio y Disponible (un checkbox sin tildar no viaja)", () => {
    expect(parseVariantEdit({ price: "15.000", isAvailable: "on" })).toEqual({ success: true, data: { price: 15000, isAvailable: true } });
    expect(parseVariantEdit({ price: "15.000" })).toEqual({ success: true, data: { price: 15000, isAvailable: false } });
  });

  it("valida el precio igual que el alta", () => {
    expect(parseVariantEdit({ price: "0", isAvailable: "on" })).toEqual({
      success: false,
      fieldErrors: { price: VARIANT_ERRORS.priceZero },
    });
  });
});

describe("isDuplicateVariantError", () => {
  it("reconoce el unique (producto, tipo, ml)", () => {
    expect(
      isDuplicateVariantError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "product_variants_product_id_variant_type_size_ml_key"',
      }),
    ).toBe(true);
  });

  it("no confunde otros uniques ni otros códigos", () => {
    expect(isDuplicateVariantError({ code: "23505", message: 'unique constraint "products_slug_key"' })).toBe(false);
    expect(isDuplicateVariantError({ code: "23514", message: "product_variants_product_id_variant_type_size_ml_key" })).toBe(false);
  });
});

describe("orderVariantsForAdmin", () => {
  it("disponibles en el orden de la tienda; las no disponibles al final", () => {
    const rows = [
      { ...bottle(100), is_available: true },
      { ...decant(10), is_available: false },
      { ...decant(5), is_available: true },
      { ...decant(3), is_available: false },
      { ...decant(3), variant_type: "full_bottle" as const, size_ml: 50, is_available: true },
    ];
    expect(orderVariantsForAdmin(rows).map((v) => `${v.variant_type}-${v.size_ml}-${v.is_available}`)).toEqual([
      "decant-5-true",
      "full_bottle-50-true",
      "full_bottle-100-true",
      "decant-3-false",
      "decant-10-false",
    ]);
  });

  it("no cambia el arreglo que recibe", () => {
    const rows = [{ ...bottle(100), is_available: true }, { ...decant(5), is_available: true }];
    orderVariantsForAdmin(rows);
    expect(rows[0].size_ml).toBe(100);
  });
});

describe("variantStockText", () => {
  it("unidades o Agotado", () => {
    expect(variantStockText(8)).toBe("8 u.");
    expect(variantStockText(1)).toBe("1 u.");
    expect(variantStockText(0)).toBe("Agotado");
  });
});

describe("variantCreatedWithoutStock (fallo parcial, decisión 100)", () => {
  it("dice qué se creó y cómo terminar", () => {
    expect(variantCreatedWithoutStock("Decant 5 ml")).toBe(
      "Se creó Decant 5 ml pero no se cargó el stock inicial. Cargalo con Mover stock.",
    );
  });
});
