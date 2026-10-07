// @vitest-environment node
import { describe, expect, it } from "vitest";
import fixture from "../../../supabase/tests/order-transitions.json";
import { Constants } from "@/types/database";
import { nextOrderStatuses } from "./order-transitions";

const { order_status, payment_method, delivery_method } = Constants.public.Enums;

describe("nextOrderStatuses", () => {
  // Mismo fixture que verifica test:db contra is_valid_order_transition (la base es la fuente de verdad).
  for (const payment of payment_method) {
    for (const delivery of delivery_method) {
      const expected = fixture[`${payment}/${delivery}` as keyof typeof fixture] as Record<string, string[]>;

      for (const status of order_status) {
        it(`${payment}/${delivery}: desde ${status}`, () => {
          expect(nextOrderStatuses({ status, payment_method: payment, delivery_method: delivery })).toEqual(
            expected[status],
          );
        });
      }
    }
  }
});
