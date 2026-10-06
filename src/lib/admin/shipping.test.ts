// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Constants } from "@/types/database";
import { canSetShippingCost } from "./shipping";

describe("canSetShippingCost (copia de guard_shipping_cost)", () => {
  it("un retiro nunca lleva costo de envío", () => {
    for (const status of Constants.public.Enums.order_status) {
      expect(canSetShippingCost({ status, delivery_method: "pickup" })).toBe(false);
    }
  });

  it("un envío se puede cargar hasta que sale o se cierra", () => {
    const open = Constants.public.Enums.order_status.filter((status) =>
      canSetShippingCost({ status, delivery_method: "delivery" }),
    );
    expect(open).toEqual(["pending", "confirmed", "paid", "preparing", "ready_for_pickup"]);
  });
});
