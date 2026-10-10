// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Constants } from "@/types/database";
import { REQUEST_STATUS_LABELS, nextRequestStatuses, sortRequestsForAdmin } from "./request-list";

const request = (id: string, status: (typeof Constants.public.Enums.request_status)[number], createdAt: string) => ({
  id,
  status,
  created_at: createdAt,
});

describe("REQUEST_STATUS_LABELS", () => {
  it("tiene una etiqueta para cada estado de la base", () => {
    for (const status of Constants.public.Enums.request_status) {
      expect(REQUEST_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("sortRequestsForAdmin", () => {
  it("pendientes primero, del más viejo al más nuevo; después el resto, del más nuevo al más viejo", () => {
    const sorted = sortRequestsForAdmin([
      request("cerrado-viejo", "completed", "2026-10-01T10:00:00Z"),
      request("pendiente-nuevo", "pending", "2026-10-09T10:00:00Z"),
      request("contactado", "contacted", "2026-10-05T10:00:00Z"),
      request("pendiente-viejo", "pending", "2026-10-02T10:00:00Z"),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["pendiente-viejo", "pendiente-nuevo", "contactado", "cerrado-viejo"]);
  });

  it("no modifica la lista original", () => {
    const list = [request("b", "pending", "2026-10-09T10:00:00Z"), request("a", "pending", "2026-10-01T10:00:00Z")];
    sortRequestsForAdmin(list);
    expect(list.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("nextRequestStatuses", () => {
  // La base no limita las transiciones de un encargo: se ofrece cualquier otro estado.
  it("ofrece todos los estados menos el actual, en el orden del flujo", () => {
    expect(nextRequestStatuses("contacted")).toEqual(["pending", "quoted", "sourcing", "completed", "cancelled"]);
  });
});
