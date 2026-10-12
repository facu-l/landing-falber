// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Constants } from "@/types/database";
import { LIMITS } from "@/lib/forms/limits";
import {
  formatSignedQuantity,
  isNotEnoughStockError,
  MOVE_CHOICES,
  MOVEMENT_LABELS,
  parseStockMove,
  parseWholeUnits,
  STOCK_MOVE_ERRORS,
  STOCK_QUANTITY_MAX,
  stockAfter,
} from "./stock-movements";

describe("parseWholeUnits", () => {
  it("acepta enteros sin signo", () => {
    expect(parseWholeUnits("3", 10)).toEqual({ success: true, value: 3 });
    expect(parseWholeUnits(" 0 ", 10)).toEqual({ success: true, value: 0 });
    expect(parseWholeUnits("", 10)).toEqual({ success: true, value: null });
  });

  it("rechaza decimales, signos, miles y texto", () => {
    for (const raw of ["2.5", "2,5", "-1", "+1", "1.000", "tres"]) {
      expect(parseWholeUnits(raw, 10_000)).toEqual({ success: false, reason: "format" });
    }
  });

  it("el tope es inclusivo", () => {
    expect(parseWholeUnits("10", 10)).toEqual({ success: true, value: 10 });
    expect(parseWholeUnits("11", 10)).toEqual({ success: false, reason: "tooHigh" });
  });
});

describe("MOVE_CHOICES (copia de la policy de 0001 y del check de signo)", () => {
  it("solo ofrece tipos manuales: venta y cancelación son del sistema", () => {
    const types = new Set(Object.values(MOVE_CHOICES).map((c) => c.type));
    expect([...types].sort()).toEqual(["adjustment", "damaged", "restock"]);
  });

  it("el signo de cada opción respeta quantity_sign_matches_type", () => {
    expect(MOVE_CHOICES.restock.sign).toBe(1);
    expect(MOVE_CHOICES.damaged.sign).toBe(-1);
    expect(MOVE_CHOICES.adjustment_add.sign).toBe(1);
    expect(MOVE_CHOICES.adjustment_subtract.sign).toBe(-1);
  });

  it("cada tipo de la base tiene su etiqueta para el historial", () => {
    for (const type of Constants.public.Enums.stock_movement_type) {
      expect(MOVEMENT_LABELS[type]).toBeTruthy();
    }
  });
});

describe("stockAfter (\"Queda en N u.\")", () => {
  it("suma o resta según la opción", () => {
    expect(stockAfter(8, "restock", 3)).toBe(11);
    expect(stockAfter(8, "damaged", 1)).toBe(7);
    expect(stockAfter(8, "adjustment_subtract", 8)).toBe(0);
    expect(stockAfter(0, "adjustment_subtract", 1)).toBe(-1);
  });
});

describe("parseStockMove", () => {
  const move = (values: Record<string, string>, current = 8) => parseStockMove(values, current);

  it("devuelve el tipo de la base y la cantidad con signo", () => {
    expect(move({ choice: "restock", quantity: "3", note: "" })).toEqual({
      success: true,
      data: { movementType: "restock", quantity: 3, note: null },
    });
    expect(move({ choice: "damaged", quantity: "1", note: " Se cayó " })).toEqual({
      success: true,
      data: { movementType: "damaged", quantity: -1, note: "Se cayó" },
    });
    expect(move({ choice: "adjustment_subtract", quantity: "8" })).toEqual({
      success: true,
      data: { movementType: "adjustment", quantity: -8, note: null },
    });
  });

  it("rechaza una opción que no está en la lista", () => {
    for (const choice of ["", "sale", "order_cancelled", "initial_stock", "toString"]) {
      const result = move({ choice, quantity: "1" });
      expect(result).toMatchObject({ success: false, fieldErrors: { choice: STOCK_MOVE_ERRORS.choice } });
    }
  });

  it("pide una cantidad entera de al menos 1 y con tope", () => {
    expect(move({ choice: "restock", quantity: "" })).toMatchObject({ fieldErrors: { quantity: STOCK_MOVE_ERRORS.quantityRequired } });
    expect(move({ choice: "restock", quantity: "0" })).toMatchObject({ fieldErrors: { quantity: STOCK_MOVE_ERRORS.quantityZero } });
    expect(move({ choice: "restock", quantity: "1,5" })).toMatchObject({ fieldErrors: { quantity: STOCK_MOVE_ERRORS.quantityFormat } });
    expect(move({ choice: "restock", quantity: String(STOCK_QUANTITY_MAX + 1) })).toMatchObject({
      fieldErrors: { quantity: STOCK_MOVE_ERRORS.quantityTooHigh },
    });
    expect(move({ choice: "restock", quantity: String(STOCK_QUANTITY_MAX) })).toMatchObject({ success: true });
  });

  it("avisa antes de enviar si no hay tanto stock para descontar", () => {
    expect(move({ choice: "damaged", quantity: "9" }, 8)).toMatchObject({
      success: false,
      fieldErrors: { quantity: STOCK_MOVE_ERRORS.notEnoughStock },
    });
    expect(move({ choice: "restock", quantity: "9" }, 0)).toMatchObject({ success: true });
  });

  it("la nota sigue el check de 0006, contando los saltos como el navegador", () => {
    const max = "n".repeat(LIMITS.stockNote);
    expect(move({ choice: "restock", quantity: "1", note: max })).toMatchObject({ success: true });
    expect(move({ choice: "restock", quantity: "1", note: `${max}n` })).toMatchObject({
      fieldErrors: { note: STOCK_MOVE_ERRORS.noteLength },
    });
    const withCrlf = `${"n".repeat(LIMITS.stockNote - 2)}\r\nn`;
    expect(move({ choice: "restock", quantity: "1", note: withCrlf })).toEqual({
      success: true,
      data: { movementType: "restock", quantity: 1, note: `${"n".repeat(LIMITS.stockNote - 2)}\nn` },
    });
  });

  it("junta los errores de todos los campos", () => {
    const result = move({ choice: "", quantity: "", note: "n".repeat(LIMITS.stockNote + 1) });
    expect(result).toEqual({
      success: false,
      fieldErrors: {
        choice: STOCK_MOVE_ERRORS.choice,
        quantity: STOCK_MOVE_ERRORS.quantityRequired,
        note: STOCK_MOVE_ERRORS.noteLength,
      },
    });
  });
});

describe("formatSignedQuantity", () => {
  it("muestra el signo siempre, con el menos tipográfico", () => {
    expect(formatSignedQuantity(3)).toBe("+3");
    expect(formatSignedQuantity(-1)).toBe("−1");
  });
});

describe("isNotEnoughStockError", () => {
  it("reconoce el check del stock que dispara el trigger del ledger", () => {
    expect(
      isNotEnoughStockError({
        code: "23514",
        message: 'new row for relation "product_variants" violates check constraint "product_variants_stock_check"',
      }),
    ).toBe(true);
  });

  it("no confunde otros checks ni otros códigos", () => {
    expect(isNotEnoughStockError({ code: "23514", message: 'violates check constraint "stock_movements_note_length"' })).toBe(false);
    expect(isNotEnoughStockError({ code: "23505", message: "product_variants_stock_check" })).toBe(false);
    expect(isNotEnoughStockError({})).toBe(false);
  });
});
