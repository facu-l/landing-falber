// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MAX_LINES, MAX_QUANTITY } from "@/lib/cart/cart";
import { parseCheckout } from "./schema";

const VARIANT = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const OTHER = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";

// Lo que manda el formulario: todo texto, como en un FormData.
const valid = {
  requestId: "3f2b8c4e-9d1a-4e6f-8b7c-2a1d0e9f8c7b",
  fullName: "  Ana Pérez ",
  whatsapp: "0221 15 555-1234",
  email: "",
  deliveryMethod: "pickup",
  paymentMethod: "transfer",
  address: "",
  city: "",
  postalCode: "",
  reference: "",
  note: "",
  items: JSON.stringify([{ variantId: VARIANT, quantity: 2 }]),
};

function errorsFor(input: Record<string, string>) {
  const result = parseCheckout(input);
  if (result.success) throw new Error("se esperaba un error de validación");
  return result.fieldErrors;
}

describe("parseCheckout", () => {
  it("normaliza un pedido válido para create_order", () => {
    expect(parseCheckout(valid)).toEqual({
      success: true,
      data: {
        requestId: valid.requestId,
        fullName: "Ana Pérez",
        whatsapp: "+5492215551234",
        email: null,
        deliveryMethod: "pickup",
        paymentMethod: "transfer",
        address: null,
        city: null,
        postalCode: null,
        reference: null,
        note: null,
        items: [{ variantId: VARIANT, quantity: 2 }],
      },
    });
  });

  it("con envío conserva la dirección", () => {
    const result = parseCheckout({
      ...valid,
      deliveryMethod: "delivery",
      address: " Calle 7 1234 ",
      city: "La Plata",
      postalCode: "1900",
      reference: "Timbre B",
      email: "ana@mail.com",
    });
    expect(result).toMatchObject({
      success: true,
      data: { address: "Calle 7 1234", city: "La Plata", postalCode: "1900", reference: "Timbre B", email: "ana@mail.com" },
    });
  });

  it("acepta que falten los campos opcionales (con retiro, el form no muestra la dirección)", () => {
    const { requestId, fullName, whatsapp, deliveryMethod, paymentMethod, items } = valid;
    const required = { requestId, fullName, whatsapp, deliveryMethod, paymentMethod, items };
    expect(parseCheckout(required)).toMatchObject({ success: true, data: { email: null, address: null, note: null } });
  });

  it("con retiro descarta la dirección que haya quedado cargada", () => {
    const result = parseCheckout({ ...valid, address: "Calle 7 1234", city: "La Plata" });
    expect(result).toMatchObject({ success: true, data: { address: null, city: null } });
  });

  it.each([
    ["nombre corto", { fullName: "A" }, "fullName"],
    ["nombre largo", { fullName: "A".repeat(81) }, "fullName"],
    ["WhatsApp inválido", { whatsapp: "555-1234" }, "whatsapp"],
    ["email inválido", { email: "ana@" }, "email"],
    ["entrega desconocida", { deliveryMethod: "drone" }, "deliveryMethod"],
    ["pago desconocido", { paymentMethod: "crypto" }, "paymentMethod"],
    ["aclaración de más de 100", { note: "x".repeat(101) }, "note"],
    ["sin request_id", { requestId: "" }, "requestId"],
  ])("rechaza %s", (_, override, field) => {
    expect(errorsFor({ ...valid, ...override })).toHaveProperty(field);
  });

  it("efectivo solo con retiro (el error va en el pago)", () => {
    const errors = errorsFor({
      ...valid,
      paymentMethod: "cash",
      deliveryMethod: "delivery",
      address: "Calle 7 1234",
      city: "La Plata",
    });
    expect(errors.paymentMethod).toBe("El pago en efectivo es solo para retiro en La Plata.");
  });

  it("envío sin dirección ni ciudad marca los dos campos", () => {
    const errors = errorsFor({ ...valid, deliveryMethod: "delivery", address: " ", city: "" });
    expect(errors).toHaveProperty("address");
    expect(errors).toHaveProperty("city");
  });

  it("muestra todos los errores juntos, también los que dependen de otro campo", () => {
    const errors = errorsFor({ ...valid, whatsapp: "abc", deliveryMethod: "delivery", paymentMethod: "cash" });
    expect(Object.keys(errors).sort()).toEqual(["address", "city", "paymentMethod", "whatsapp"]);
  });

  it("da un solo mensaje por campo, en castellano", () => {
    const errors = errorsFor({ ...valid, whatsapp: "abc" });
    expect(errors.whatsapp).toBe("Revisá el número: con código de área, sin 0 ni 15 (ej. 221 555 1234).");
  });

  describe("items (el carrito)", () => {
    it.each([
      ["vacío", "[]"],
      ["JSON roto", "{roto"],
      ["cantidad 0", JSON.stringify([{ variantId: VARIANT, quantity: 0 }])],
      [`más de ${MAX_QUANTITY} unidades`, JSON.stringify([{ variantId: VARIANT, quantity: MAX_QUANTITY + 1 }])],
      ["variante que no es UUID", JSON.stringify([{ variantId: "x", quantity: 1 }])],
      [
        "variantes repetidas",
        JSON.stringify([
          { variantId: VARIANT, quantity: 1 },
          { variantId: VARIANT, quantity: 1 },
        ]),
      ],
      [
        `más de ${MAX_LINES} líneas`,
        JSON.stringify(
          Array.from({ length: MAX_LINES + 1 }, (_, i) => ({
            variantId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
            quantity: 1,
          })),
        ),
      ],
    ])("rechaza un carrito %s", (_, items) => {
      expect(errorsFor({ ...valid, items })).toHaveProperty("items");
    });

    it("descarta campos de más, como un precio", () => {
      const items = JSON.stringify([
        { variantId: VARIANT, quantity: 1, price: 1 },
        { variantId: OTHER, quantity: 3 },
      ]);
      expect(parseCheckout({ ...valid, items })).toMatchObject({
        success: true,
        data: {
          items: [
            { variantId: VARIANT, quantity: 1 },
            { variantId: OTHER, quantity: 3 },
          ],
        },
      });
    });
  });
});
