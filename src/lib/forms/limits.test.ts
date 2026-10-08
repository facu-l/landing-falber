// @vitest-environment node
import { describe, expect, it } from "vitest";
import { migrationFunction, migrationSql } from "@/test/migration";
import { LIMITS } from "./limits";

/*
 * LIMITS repite topes de la base para dar errores por campo. Si uno cambia de un solo
 * lado, el formulario acepta lo que la base rechaza con un mensaje general (o al revés):
 * estos tests atan cada tope a su línea de la migración.
 */

describe("LIMITS coincide con la migración", () => {
  const createOrder = migrationFunction("create_order");

  it.each([
    ["dirección", "v_address", LIMITS.address],
    ["ciudad", "v_city", LIMITS.city],
    ["código postal", "v_postal_code", LIMITS.postalCode],
    ["referencia", "v_reference", LIMITS.reference],
    ["aclaración", "v_note", LIMITS.note],
  ])("create_order valida el largo de la %s con el mismo tope", (_field, variable, max) => {
    expect(createOrder).toContain(`length(${variable}) > ${max}`);
  });

  it("create_order valida el nombre con el mismo tope", () => {
    expect(createOrder).toContain(`length(v_name) not between 2 and ${LIMITS.fullName}`);
  });

  it.each([
    ["delivery_address", LIMITS.address],
    ["delivery_city", LIMITS.city],
    ["delivery_postal_code", LIMITS.postalCode],
    ["delivery_reference", LIMITS.reference],
  ])("el check delivery_lengths limita %s con el mismo tope", (column, max) => {
    expect(migrationSql()).toContain(`length(${column}) <= ${max}`);
  });
});
