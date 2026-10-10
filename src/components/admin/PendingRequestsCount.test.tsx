import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ countPendingRequests: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/admin/requests", () => ({ countPendingRequests: mocks.countPendingRequests }));

const { PendingRequestsCount } = await import("./PendingRequestsCount");

afterEach(() => vi.clearAllMocks());

describe("PendingRequestsCount", () => {
  it("muestra cuántos encargos esperan, y el lector de pantalla oye 'pendientes'", async () => {
    mocks.countPendingRequests.mockResolvedValue(2);
    const { container } = render(await PendingRequestsCount());

    expect(container.textContent).toBe("2 pendientes");
    expect(screen.getByText("pendientes", { exact: false }).className).toContain("sr-only");
  });

  // Sin pendientes (o sin sesión de admin: RLS cuenta 0) no se muestra nada.
  it("con 0 no muestra nada", async () => {
    mocks.countPendingRequests.mockResolvedValue(0);
    const { container } = render(await PendingRequestsCount());
    expect(container.textContent).toBe("");
  });
});
