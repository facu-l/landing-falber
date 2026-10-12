import type { DbError } from "@/lib/db-errors";
import { LIMITS } from "@/lib/forms/limits";
import type { Database } from "@/types/database";

/*
 * Movimientos de stock del panel (/admin/productos/[id] → Mover stock e historial).
 * El stock cambia solo insertando en stock_movements: la base aplica el signo
 * (quantity_sign_matches_type), los tipos permitidos (policy "admin: add manual stock
 * movements") y que no quede negativo (product_variants_stock_check). Esto repite esas
 * reglas para avisar antes de enviar. Puras: se prueban sin base.
 */

export type StockMovementType = Database["public"]["Enums"]["stock_movement_type"];

/** Tope del formulario: frena un cero de más. La base no tiene tope (solo stock >= 0). */
export const STOCK_QUANTITY_MAX = 1000;

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  initial_stock: "Stock inicial",
  restock: "Reposición",
  adjustment: "Ajuste",
  damaged: "Dañado o derramado",
  sale: "Venta",
  order_cancelled: "Devuelto por cancelación",
};

/**
 * Las opciones de Mover stock. El ajuste va en dos para que el signo lo decida la
 * opción y no un "-" tipeado. Stock inicial no está: se carga al crear la presentación.
 */
export const MOVE_CHOICES = {
  restock: { type: "restock", sign: 1, label: "Reposición" },
  adjustment_add: { type: "adjustment", sign: 1, label: "Ajuste: sumar" },
  adjustment_subtract: { type: "adjustment", sign: -1, label: "Ajuste: restar" },
  damaged: { type: "damaged", sign: -1, label: "Dañado o derramado" },
} as const satisfies Record<string, { type: StockMovementType; sign: 1 | -1; label: string }>;

export type MoveChoice = keyof typeof MOVE_CHOICES;

export const STOCK_MOVE_ERRORS = {
  choice: "Elegí qué pasó con el stock.",
  quantityRequired: "Escribí cuántas unidades.",
  quantityFormat: "Escribí las unidades en números enteros (ej. 3).",
  quantityZero: "Tiene que ser al menos 1 u.",
  quantityTooHigh: `Podés mover hasta ${STOCK_QUANTITY_MAX} u. de una vez.`,
  notEnoughStock: "No hay tanto stock para descontar.",
  noteLength: `La nota puede tener hasta ${LIMITS.stockNote} caracteres.`,
} as const;

// Unidades y ml: enteros sin signo ni separador de miles.
const WHOLE_UNITS = /^\d+$/;

export type WholeUnitsResult = { success: true; value: number | null } | { success: false; reason: "format" | "tooHigh" };

/** "" = null: cada formulario decide si vale vacío. `max` es inclusivo. */
export function parseWholeUnits(raw: string, max: number): WholeUnitsResult {
  const text = raw.trim();
  if (!text) return { success: true, value: null };
  if (!WHOLE_UNITS.test(text)) return { success: false, reason: "format" };

  const value = Number(text);
  if (value > max) return { success: false, reason: "tooHigh" };
  return { success: true, value };
}

/** Stock que queda después del movimiento ("Queda en N u."). Negativo = no alcanza. */
export function stockAfter(current: number, choice: MoveChoice, amount: number): number {
  return current + MOVE_CHOICES[choice].sign * amount;
}

/** Igual que la nota de 0006: el form manda CRLF y el textarea cuenta un salto como uno. */
export function normalizeStockNote(raw: string | undefined): string {
  return (raw ?? "").replace(/\r\n?/g, "\n").trim();
}

export type StockMoveFieldErrors = Partial<Record<"choice" | "quantity" | "note", string>>;

export type StockMove = { movementType: StockMovementType; quantity: number; note: string | null };

/**
 * Lo que manda Mover stock. `currentStock` es el que vio el admin: puede estar viejo
 * (otra pestaña, una venta), así que la base sigue siendo la que decide.
 */
export function parseStockMove(
  values: Record<string, string | undefined>,
  currentStock: number,
): { success: true; data: StockMove } | { success: false; fieldErrors: StockMoveFieldErrors } {
  const fieldErrors: StockMoveFieldErrors = {};

  const choiceValue = values.choice ?? "";
  const choice = Object.hasOwn(MOVE_CHOICES, choiceValue) ? (choiceValue as MoveChoice) : null;
  if (!choice) fieldErrors.choice = STOCK_MOVE_ERRORS.choice;

  const parsed = parseWholeUnits(values.quantity ?? "", STOCK_QUANTITY_MAX);
  let amount: number | null = null;
  if (!parsed.success) {
    fieldErrors.quantity = parsed.reason === "format" ? STOCK_MOVE_ERRORS.quantityFormat : STOCK_MOVE_ERRORS.quantityTooHigh;
  } else if (parsed.value === null) {
    fieldErrors.quantity = STOCK_MOVE_ERRORS.quantityRequired;
  } else if (parsed.value === 0) {
    fieldErrors.quantity = STOCK_MOVE_ERRORS.quantityZero;
  } else {
    amount = parsed.value;
  }

  if (choice && amount !== null && stockAfter(currentStock, choice, amount) < 0) {
    fieldErrors.quantity = STOCK_MOVE_ERRORS.notEnoughStock;
  }

  const note = normalizeStockNote(values.note);
  if (note.length > LIMITS.stockNote) fieldErrors.note = STOCK_MOVE_ERRORS.noteLength;

  if (!choice || amount === null || Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  const { type, sign } = MOVE_CHOICES[choice];
  return { success: true, data: { movementType: type, quantity: sign * amount, note: note || null } };
}

/** "+3" o "−1" (menos tipográfico, mismo ancho que el + con números tabulares). */
export function formatSignedQuantity(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : `−${Math.abs(quantity)}`;
}

export const STOCK_MOVE_SAVE_ERROR = "No pudimos mover el stock. Probá de nuevo en unos segundos.";
export const STOCK_MOVE_NOT_FOUND = "Esa presentación ya no está. Recargá la página.";

/** Estado de Mover stock (useActionState). Fuera de las acciones: un archivo "use server" solo exporta funciones async. */
export type StockMoveState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: StockMoveFieldErrors;
      /** Lo escrito: React resetea el form después de la acción. */
      values: Record<string, string>;
    };

export const INITIAL_STOCK_MOVE_STATE: StockMoveState = { status: "idle" };

/** El stock nuevo lo muestra la fila después del refresh: es el que calculó la base. */
export const STOCK_MOVED = "Stock actualizado.";

/**
 * El check de product_variants.stock, que dispara el trigger del ledger cuando un
 * movimiento lo dejaría negativo. No es un código nuestro: se reconoce por código y
 * nombre del constraint, como isDuplicateSlugError.
 */
export function isNotEnoughStockError(error: DbError): boolean {
  return error.code === "23514" && (error.message ?? "").includes("product_variants_stock_check");
}
