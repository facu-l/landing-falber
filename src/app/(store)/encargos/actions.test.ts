// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_REQUEST_ERROR, REQUEST_ERRORS } from "@/lib/requests/errors";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  verifyHumanRequest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/security/verify-request", () => ({ verifyHumanRequest: mocks.verifyHumanRequest }));

const { createPerfumeRequest } = await import("./actions");

const CLIENT_KEY = "a".repeat(64);
const VARIANT = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const REQUEST_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function form(overrides: Record<string, string> = {}) {
  const fields = {
    fullName: "Ana Pérez",
    whatsapp: "0221 15 555-1234",
    perfumeName: "The Most Wanted",
    brand: "Azzaro",
    presentation: "Frasco 100 ml",
    note: "",
    variantId: VARIANT,
    "cf-turnstile-response": "token-ok",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  mocks.verifyHumanRequest.mockResolvedValue({ ok: true, clientKey: CLIENT_KEY });
  mocks.rpc.mockResolvedValue({ data: REQUEST_ID, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("createPerfumeRequest", () => {
  it("crea el encargo con create_perfume_request y la clave hasheada", async () => {
    await expect(createPerfumeRequest({ status: "idle" }, form())).resolves.toEqual({
      status: "success",
      perfumeName: "The Most Wanted",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_perfume_request", {
      p_client_key: CLIENT_KEY,
      p_full_name: "Ana Pérez",
      p_whatsapp: "+5492215551234",
      p_perfume_name: "The Most Wanted",
      p_brand: "Azzaro",
      p_presentation: "Frasco 100 ml",
      p_note: "",
      p_variant_id: VARIANT,
    });
  });

  it("un encargo libre no manda p_variant_id (la base usa null)", async () => {
    await createPerfumeRequest({ status: "idle" }, form({ variantId: "", brand: "", presentation: "" }));

    const args = mocks.rpc.mock.calls[0][1];
    expect(args).not.toHaveProperty("p_variant_id");
    expect(args).toMatchObject({ p_brand: "", p_presentation: "" });
  });

  it("con errores del formulario no gasta el token de Turnstile ni llama a la base", async () => {
    const state = await createPerfumeRequest({ status: "idle" }, form({ whatsapp: "555", perfumeName: "" }));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { whatsapp: expect.any(String), perfumeName: expect.any(String) },
    });
    expect(mocks.verifyHumanRequest).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("devuelve lo que escribió el cliente, sin el token", async () => {
    const state = await createPerfumeRequest({ status: "idle" }, form({ whatsapp: "555" }));
    expect(state).toMatchObject({ values: { fullName: "Ana Pérez", whatsapp: "555", perfumeName: "The Most Wanted" } });
    expect(state).not.toHaveProperty("values.cf-turnstile-response");
  });

  it("pide un token resuelto en el formulario de encargos", async () => {
    const data = form();
    await createPerfumeRequest({ status: "idle" }, data);
    expect(mocks.verifyHumanRequest).toHaveBeenCalledWith(data, "encargo");
  });

  it("si Turnstile rechaza, no llama a la base", async () => {
    mocks.verifyHumanRequest.mockResolvedValue({ ok: false });
    const state = await createPerfumeRequest({ status: "idle" }, form());

    expect(state).toMatchObject({ status: "error", message: expect.stringMatching(/Enviar encargo/) });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("traduce un error conocido de la base sin loguearlo y conserva lo escrito", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "RATE_LIMITED", code: "P0001" } });

    await expect(createPerfumeRequest({ status: "idle" }, form())).resolves.toMatchObject({
      status: "error",
      message: REQUEST_ERRORS.RATE_LIMITED,
      values: { fullName: "Ana Pérez" },
    });
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    ["un error desconocido de la base", () => mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom", code: "23514" } })],
    ["una respuesta con forma inesperada", () => mocks.rpc.mockResolvedValue({ data: 42, error: null })],
    ["una excepción (ej. red)", () => mocks.rpc.mockRejectedValue(new TypeError("fetch failed"))],
  ])("con %s muestra el mensaje genérico y lo loguea", async (_, arrange) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    arrange();

    await expect(createPerfumeRequest({ status: "idle" }, form())).resolves.toMatchObject({
      status: "error",
      message: GENERIC_REQUEST_ERROR,
    });
    expect(log).toHaveBeenCalled();
  });
  // Un check que falla pone la fila en details ("Failing row contains (...)"): datos del
  // cliente que no pueden terminar en los logs de Netlify (Ley 25.326).
  it("loguea solo el código y el mensaje del error, nunca details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "new row violates check constraint", code: "23514", details: "Failing row contains (Ana Pérez, +5492215551234, Calle 7 123)" },
    });

    await createPerfumeRequest({ status: "idle" }, form());

    expect(log).toHaveBeenCalledWith("[encargos] create_perfume_request falló", { code: "23514", message: "new row violates check constraint" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("Ana Pérez");
  });
});
