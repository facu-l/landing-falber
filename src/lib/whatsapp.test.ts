// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { OrderSummary } from "./orders/summary";
import { buildRequestWhatsAppMessage, buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsapp";

const order: OrderSummary = {
  orderNumber: "FAL-0042",
  status: "pending",
  paymentMethod: "transfer",
  deliveryMethod: "pickup",
  subtotal: 38500,
  shippingCost: null,
  total: 38500,
  createdAt: "2026-10-05T12:00:00Z",
  customerFirstName: "Ana",
  items: [
    { productName: "Sauvage EDT", variantLabel: "Decant 5 ml", unitPrice: 10000, quantity: 1, lineTotal: 10000 },
    { productName: "Santal 33", variantLabel: "Decant 10 ml", unitPrice: 14250, quantity: 2, lineTotal: 28500 },
  ],
};

describe("buildWhatsAppMessage", () => {
  it("arma el mensaje del documento maestro", () => {
    expect(buildWhatsAppMessage(order)).toBe(
      [
        "Hola FALBER. Quiero confirmar mi pedido FAL-0042.",
        "",
        "• 1x Sauvage EDT — Decant 5 ml ($10.000)",
        "• 2x Santal 33 — Decant 10 ml ($28.500)",
        "",
        "Total estimado: $38.500",
        "Entrega: Retiro en La Plata",
        "Pago: Transferencia",
      ].join("\n"),
    );
  });

  it("con envío y efectivo usa sus etiquetas", () => {
    const message = buildWhatsAppMessage({ ...order, deliveryMethod: "delivery", paymentMethod: "cash" });
    expect(message).toContain("Entrega: Envío a domicilio");
    expect(message).toContain("Pago: Efectivo");
  });

  it("si ya hay costo de envío, lo muestra y el total lo incluye", () => {
    const message = buildWhatsAppMessage({ ...order, deliveryMethod: "delivery", shippingCost: 3000, total: 41500 });
    expect(message).toContain("Envío: $3.000\nTotal estimado: $41.500");
  });

  it("respeta la voz de la marca: sin emojis ni signos de exclamación", () => {
    expect(buildWhatsAppMessage(order)).not.toMatch(/[!¡]|\p{Extended_Pictographic}/u);
  });
});

describe("buildWhatsAppUrl", () => {
  it("arma el link de wa.me con el mensaje codificado", () => {
    const url = new URL(buildWhatsAppUrl("5492355481449", "Hola FALBER.\n• 1x Sauvage — 5 ml ($10.000)"));
    expect(url.origin + url.pathname).toBe("https://wa.me/5492355481449");
    expect(url.searchParams.get("text")).toBe("Hola FALBER.\n• 1x Sauvage — 5 ml ($10.000)");
  });

  it("deja solo los dígitos del número", () => {
    expect(buildWhatsAppUrl("+54 9 2355 48-1449", "x")).toBe("https://wa.me/5492355481449?text=x");
  });
});

describe("buildRequestWhatsAppMessage", () => {
  const request = {
    fullName: "Ana Pérez",
    perfumeName: "Aventus",
    brand: "Creed",
    presentation: "Decant 10 ml",
    note: "Si llega antes de fin de mes",
  };

  it("arma el mensaje con todos los datos del encargo", () => {
    expect(buildRequestWhatsAppMessage(request)).toBe(
      [
        "Hola FALBER. Soy Ana Pérez y hice un encargo en la web.",
        "",
        "Perfume: Aventus",
        "Marca: Creed",
        "Presentación: Decant 10 ml",
        "Nota: Si llega antes de fin de mes",
      ].join("\n"),
    );
  });

  it("omite los datos opcionales que no se completaron", () => {
    const message = buildRequestWhatsAppMessage({
      ...request,
      brand: null,
      presentation: null,
      note: null,
    });
    expect(message).toBe("Hola FALBER. Soy Ana Pérez y hice un encargo en la web.\n\nPerfume: Aventus");
  });

  it("sobrevive al link: & y saltos de línea llegan intactos", () => {
    const message = buildRequestWhatsAppMessage({ ...request, perfumeName: "Light Blue & Co" });
    const url = new URL(buildWhatsAppUrl("5492355481449", message));
    expect(url.searchParams.get("text")).toBe(message);
  });
});
