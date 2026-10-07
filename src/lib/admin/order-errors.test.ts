// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ADMIN_ORDER_ERRORS, adminOrderError, GENERIC_ADMIN_ORDER_ERROR } from "./order-errors";

describe("adminOrderError", () => {
  it("traduce los códigos de la base del admin de pedidos", () => {
    for (const code of ["INVALID_STATUS_TRANSITION", "SHIPPING_COST_PICKUP", "SHIPPING_COST_LOCKED"] as const) {
      expect(adminOrderError({ message: code })).toMatchObject({ code, known: true, message: ADMIN_ORDER_ERRORS[code] });
    }
  });

  it("un error que no es nuestro (constraint, red) es genérico y hay que loguearlo", () => {
    expect(adminOrderError({ message: "new row violates check constraint" })).toEqual({
      code: "UNKNOWN",
      message: GENERIC_ADMIN_ORDER_ERROR,
      detail: null,
      known: false,
    });
  });
});
