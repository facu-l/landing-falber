// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHIPPING_ESTIMATE_REQUIRED,
  SHIPPING_ESTIMATES_NOT_SAVED,
  SHIPPING_ESTIMATES_SAVE_ERROR,
} from "@/lib/admin/shipping-estimates";

const mocks = vi.hoisted(() => ({
  requireAdminAction: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, refresh: mocks.refresh }));
vi.mock("@/lib/admin/auth", () => ({ requireAdminAction: mocks.requireAdminAction }));

const { updateShippingEstimates } = await import("./actions");

const ACCESS_FAILED = { ok: false, message: "No pudimos verificar tu acceso." } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** update().eq().select() de supabase-js, con la respuesta que da la base. */
function databaseAnswers(result: { data: unknown; error: unknown }) {
  mocks.select.mockResolvedValue(result);
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.update.mockReturnValue({ eq: mocks.eq });
}

beforeEach(() => {
  mocks.requireAdminAction.mockResolvedValue({
    ok: true,
    supabase: { from: () => ({ update: mocks.update }) },
    user: { id: "admin" },
  });
  databaseAnswers({ data: [{ id: true }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("updateShippingEstimates", () => {
  it("sin admin no escribe nada (requireAdminAction corta con un redirect)", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateShippingEstimates({ status: "idle" }, form({ toBranch: "7000", toHome: "9000" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no se pudo verificar el acceso, vuelve al formulario con lo escrito", async () => {
    mocks.requireAdminAction.mockResolvedValue(ACCESS_FAILED);

    await expect(
      updateShippingEstimates({ status: "idle" }, form({ toBranch: "7000", toHome: "9000" })),
    ).resolves.toEqual({ status: "error", message: ACCESS_FAILED.message, values: { toBranch: "7000", toHome: "9000" } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("guarda los dos montos, vence el caché del checkout y refresca", async () => {
    await expect(
      updateShippingEstimates({ status: "idle" }, form({ toBranch: "7.500", toHome: "$ 9.500" })),
    ).resolves.toEqual({ status: "success", message: "Envíos estimados guardados." });

    expect(mocks.update).toHaveBeenCalledWith({ estimate_to_branch: 7500, estimate_to_home: 9500 });
    expect(mocks.eq).toHaveBeenCalledWith("id", true);
    // El checkout los muestra cacheados: sin esto, verían el monto viejo hasta un minuto.
    expect(mocks.updateTag).toHaveBeenCalledWith("shipping-rates");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("montos inválidos no llegan a la base y vuelven con lo escrito", async () => {
    await expect(
      updateShippingEstimates({ status: "idle" }, form({ toBranch: "", toHome: "9000" })),
    ).resolves.toEqual({
      status: "error",
      fieldErrors: { toBranch: SHIPPING_ESTIMATE_REQUIRED },
      values: { toBranch: "", toHome: "9000" },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no tocó ninguna fila, avisa y no vence el caché", async () => {
    databaseAnswers({ data: [], error: null });

    await expect(
      updateShippingEstimates({ status: "idle" }, form({ toBranch: "7000", toHome: "9000" })),
    ).resolves.toMatchObject({ status: "error", message: SHIPPING_ESTIMATES_NOT_SAVED });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("un error de la base se loguea sin details, con mensaje genérico y lo escrito", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseAnswers({ data: null, error: { message: "fetch failed", code: "XX000", details: "algo" } });

    await expect(
      updateShippingEstimates({ status: "idle" }, form({ toBranch: "7000", toHome: "9000" })),
    ).resolves.toEqual({
      status: "error",
      message: SHIPPING_ESTIMATES_SAVE_ERROR,
      values: { toBranch: "7000", toHome: "9000" },
    });
    expect(log).toHaveBeenCalledWith("[admin] guardar los envíos estimados falló", { code: "XX000", message: "fetch failed" });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
