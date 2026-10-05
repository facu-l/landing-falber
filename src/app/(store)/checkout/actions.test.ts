// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERIC_ORDER_ERROR, ORDER_ERRORS } from "@/lib/order-errors";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  updateTag: vi.fn(),
  verifyTurnstile: vi.fn(),
  headers: new Headers({ "x-nf-client-connection-ip": "203.0.113.7" }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => mocks.headers }));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/security/turnstile", () => ({ verifyTurnstile: mocks.verifyTurnstile }));

const { createOrder } = await import("./actions");

const VARIANT = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const ORDER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const REQUEST_ID = "3f2b8c4e-9d1a-4e6f-8b7c-2a1d0e9f8c7b";

function form(overrides: Record<string, string> = {}) {
  const fields = {
    requestId: REQUEST_ID,
    fullName: "Ana Pérez",
    whatsapp: "0221 15 555-1234",
    email: "",
    deliveryMethod: "pickup",
    paymentMethod: "transfer",
    address: "",
    city: "",
    postalCode: "",
    reference: "",
    note: "Retiro el sábado",
    items: JSON.stringify([{ variantId: VARIANT, quantity: 2 }]),
    "cf-turnstile-response": "token-ok",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("IP_HASH_SECRET", "s".repeat(64));
  mocks.verifyTurnstile.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({
    data: { order_id: ORDER_ID, order_number: "FAL-0042", duplicate: false },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createOrder", () => {
  it("crea el pedido con create_order, invalida el catálogo y devuelve el id", async () => {
    await expect(createOrder({ status: "idle" }, form())).resolves.toEqual({ status: "success", orderId: ORDER_ID });

    expect(mocks.rpc).toHaveBeenCalledWith("create_order", {
      p_request_id: REQUEST_ID,
      p_client_key: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_full_name: "Ana Pérez",
      p_whatsapp: "+5492215551234",
      p_email: "",
      p_payment_method: "transfer",
      p_delivery_method: "pickup",
      p_delivery_address: "",
      p_delivery_city: "",
      p_delivery_postal_code: "",
      p_delivery_reference: "",
      p_order_note: "Retiro el sábado",
      p_items: [{ variant_id: VARIANT, quantity: 2 }],
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
  });

  it("verifica Turnstile con el token del widget y la IP del cliente", async () => {
    await createOrder({ status: "idle" }, form());
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith("token-ok", {
      secret: "1x0000000000000000000000000000000AA",
      remoteIp: "203.0.113.7",
    });
  });

  it("nunca manda la IP en crudo a la base", async () => {
    await createOrder({ status: "idle" }, form());
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("203.0.113.7");
  });

  it("un reintento con el mismo request_id devuelve el mismo pedido", async () => {
    mocks.rpc.mockResolvedValue({
      data: { order_id: ORDER_ID, order_number: "FAL-0042", duplicate: true },
      error: null,
    });
    await expect(createOrder({ status: "idle" }, form())).resolves.toEqual({ status: "success", orderId: ORDER_ID });
  });

  it("con errores del formulario no gasta el token de Turnstile ni llama a la base", async () => {
    const state = await createOrder({ status: "idle" }, form({ whatsapp: "555", fullName: "" }));

    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { whatsapp: expect.any(String), fullName: expect.any(String) },
    });
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("devuelve lo que escribió el cliente para no borrarle el formulario", async () => {
    const state = await createOrder({ status: "idle" }, form({ whatsapp: "555" }));
    expect(state).toMatchObject({ values: { fullName: "Ana Pérez", whatsapp: "555", note: "Retiro el sábado" } });
    expect(state).not.toHaveProperty("values.cf-turnstile-response");
  });

  it("si Turnstile rechaza, no llama a la base", async () => {
    mocks.verifyTurnstile.mockResolvedValue(false);
    const state = await createOrder({ status: "idle" }, form());

    expect(state).toMatchObject({ status: "error", message: expect.stringMatching(/verificar/) });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("traduce un error conocido de la base, con la variante, sin invalidar el catálogo", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "INSUFFICIENT_STOCK", details: VARIANT, code: "P0001" } });

    await expect(createOrder({ status: "idle" }, form())).resolves.toMatchObject({
      status: "error",
      message: ORDER_ERRORS.INSUFFICIENT_STOCK,
      variantId: VARIANT,
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    ["un error desconocido de la base", () => mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom", code: "23514" } })],
    ["una respuesta con forma inesperada", () => mocks.rpc.mockResolvedValue({ data: { id: 1 }, error: null })],
    ["una excepción (ej. red)", () => mocks.rpc.mockRejectedValue(new TypeError("fetch failed"))],
  ])("con %s muestra el mensaje genérico y lo loguea", async (_, arrange) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    arrange();

    await expect(createOrder({ status: "idle" }, form())).resolves.toMatchObject({
      status: "error",
      message: GENERIC_ORDER_ERROR,
    });
    expect(log).toHaveBeenCalled();
  });
});
