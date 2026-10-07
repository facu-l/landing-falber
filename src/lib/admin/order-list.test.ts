// @vitest-environment node
import { describe, expect, it } from "vitest";
import { autoCancelWarning, sortOrdersForAdmin } from "./order-list";

const NOW = new Date("2026-10-06T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe("sortOrdersForAdmin", () => {
  it("pone los pendientes primero, el más viejo arriba (es el más cerca de cancelarse solo)", () => {
    const orders = [
      { id: "confirmado-nuevo", status: "confirmed" as const, created_at: hoursAgo(1) },
      { id: "pendiente-nuevo", status: "pending" as const, created_at: hoursAgo(2) },
      { id: "entregado-viejo", status: "completed" as const, created_at: hoursAgo(90) },
      { id: "pendiente-viejo", status: "pending" as const, created_at: hoursAgo(30) },
      { id: "pagado", status: "paid" as const, created_at: hoursAgo(5) },
    ];

    expect(sortOrdersForAdmin(orders).map((o) => o.id)).toEqual([
      "pendiente-viejo",
      "pendiente-nuevo",
      "confirmado-nuevo",
      "pagado",
      "entregado-viejo",
    ]);
  });

  it("no modifica el array que recibe", () => {
    const orders = [
      { id: "a", status: "paid" as const, created_at: hoursAgo(1) },
      { id: "b", status: "pending" as const, created_at: hoursAgo(2) },
    ];
    sortOrdersForAdmin(orders);
    expect(orders.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("autoCancelWarning", () => {
  it("no avisa en un pendiente de menos de 24 h", () => {
    expect(autoCancelWarning({ status: "pending", created_at: hoursAgo(23.9) }, NOW)).toBeNull();
  });

  it("avisa desde las 24 h con las horas enteras que faltan hasta las 48 (redondea para abajo)", () => {
    expect(autoCancelWarning({ status: "pending", created_at: hoursAgo(24) }, NOW)).toEqual({ hoursLeft: 24 });
    expect(autoCancelWarning({ status: "pending", created_at: hoursAgo(40.5) }, NOW)).toEqual({ hoursLeft: 7 });
  });

  it("con menos de una hora (o ya vencido, esperando a pg_cron) dice 0", () => {
    expect(autoCancelWarning({ status: "pending", created_at: hoursAgo(47.5) }, NOW)).toEqual({ hoursLeft: 0 });
    expect(autoCancelWarning({ status: "pending", created_at: hoursAgo(48.4) }, NOW)).toEqual({ hoursLeft: 0 });
  });

  it("solo aplica a pedidos pendientes", () => {
    expect(autoCancelWarning({ status: "confirmed", created_at: hoursAgo(40) }, NOW)).toBeNull();
  });
});
