// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminAction: vi.fn(),
  refresh: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/admin/auth", () => ({ requireAdminAction: mocks.requireAdminAction }));

const { updateRequestStatus } = await import("./actions");
const { REQUEST_CHANGED, REQUEST_NOT_FOUND, REQUEST_SAVE_FAILED } = await import("@/lib/admin/request-action");

const REQUEST_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ACCESS_FAILED = { ok: false, message: "No pudimos verificar tu acceso." } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// El form manda el estado que el admin estaba viendo (fromStatus) y el elegido (status).
const change = (status: string, fromStatus = "pending") => form({ requestId: REQUEST_ID, fromStatus, status });

/** update().eq().eq().select() de supabase-js, con la respuesta que da la base. */
function databaseAnswers(result: { data: unknown; error: unknown }) {
  mocks.select.mockResolvedValue(result);
  const filters = { eq: mocks.eq, select: mocks.select };
  mocks.eq.mockReturnValue(filters);
  mocks.update.mockReturnValue(filters);
}

beforeEach(() => {
  mocks.requireAdminAction.mockResolvedValue({
    ok: true,
    supabase: { from: (table: string) => (table === "perfume_requests" ? { update: mocks.update } : null) },
    user: { id: "admin" },
  });
  databaseAnswers({ data: [{ id: REQUEST_ID }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("updateRequestStatus", () => {
  it("sin admin no escribe nada (requireAdminAction corta con un redirect)", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateRequestStatus({ status: "idle" }, change("contacted"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no se pudo verificar el acceso, vuelve sin escribir nada", async () => {
    mocks.requireAdminAction.mockResolvedValue(ACCESS_FAILED);

    await expect(updateRequestStatus({ status: "idle" }, change("contacted"))).resolves.toEqual({
      status: "error",
      message: ACCESS_FAILED.message,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cambia el estado solo si el encargo sigue en el estado que el admin veía, y refresca", async () => {
    await expect(updateRequestStatus({ status: "idle" }, change("contacted"))).resolves.toEqual({
      status: "success",
      message: "Estado actualizado: Contactado.",
    });

    expect(mocks.update).toHaveBeenCalledWith({ status: "contacted" });
    expect(mocks.eq).toHaveBeenCalledWith("id", REQUEST_ID);
    expect(mocks.eq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("si el encargo cambió desde otra pestaña (0 filas), no lo pisa y pide recargar", async () => {
    databaseAnswers({ data: [], error: null });

    await expect(updateRequestStatus({ status: "idle" }, change("cancelled"))).resolves.toEqual({
      status: "error",
      message: REQUEST_CHANGED,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["un estado que no existe", change("borrado")],
    ["el mismo estado que ya tiene", change("pending", "pending")],
    ["un id que no es UUID", form({ requestId: "x", fromStatus: "pending", status: "contacted" })],
  ])("con %s no escribe", async (_case, data) => {
    await expect(updateRequestStatus({ status: "idle" }, data)).resolves.toEqual({
      status: "error",
      message: REQUEST_NOT_FOUND,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("un error de la base se loguea sin datos personales y muestra un mensaje genérico", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseAnswers({ data: null, error: { code: "42501", message: "permission denied", details: "Failing row contains (Ana)" } });

    await expect(updateRequestStatus({ status: "idle" }, change("contacted"))).resolves.toEqual({
      status: "error",
      message: REQUEST_SAVE_FAILED,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("Ana");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
