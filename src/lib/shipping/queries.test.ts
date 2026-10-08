// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ single: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ single: mocks.single }) }) }),
}));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "http://x", publishableKey: "k" }) }));

const { getShippingRatesOrNull } = await import("./queries");

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("getShippingRatesOrNull", () => {
  it("devuelve los estimados de la tabla", async () => {
    mocks.single.mockResolvedValue({
      data: { estimate_to_branch: 7000, estimate_to_home: 9000, id: true, updated_at: "" },
      error: null,
    });
    await expect(getShippingRatesOrNull()).resolves.toEqual({ toBranch: 7000, toHome: 9000 });
  });

  // Son informativos: si la base no responde, el checkout sigue con el texto de siempre.
  it("si la lectura falla, devuelve null y lo loguea en vez de romper el checkout", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.single.mockResolvedValue({ data: null, error: { message: "fetch failed" } });

    await expect(getShippingRatesOrNull()).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith("[checkout] sin envíos estimados", expect.any(Error));
  });
});
