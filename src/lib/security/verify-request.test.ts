// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(),
  headers: new Headers({ "x-nf-client-connection-ip": "203.0.113.7" }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => mocks.headers }));
vi.mock("./turnstile", () => ({ verifyTurnstile: mocks.verifyTurnstile }));

const { TURNSTILE_FIELD } = await import("@/lib/forms/form-data");
const { verifyHumanRequest } = await import("./verify-request");
const { hashClientKey } = await import("./client-key");

const SECRET = "s".repeat(64);

function form(token?: string) {
  const data = new FormData();
  data.set("fullName", "Ana Pérez");
  if (token !== undefined) data.set(TURNSTILE_FIELD, token);
  return data;
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("IP_HASH_SECRET", SECRET);
  mocks.verifyTurnstile.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("verifyHumanRequest", () => {
  it("verifica Turnstile con el token del formulario y la IP del cliente", async () => {
    await verifyHumanRequest(form("token-ok"));
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith("token-ok", {
      secret: "1x0000000000000000000000000000000AA",
      remoteIp: "203.0.113.7",
    });
  });

  it("si pasa, devuelve el HMAC de la IP (nunca la IP en crudo)", async () => {
    await expect(verifyHumanRequest(form("token-ok"))).resolves.toEqual({
      ok: true,
      clientKey: hashClientKey("203.0.113.7", SECRET),
    });
  });

  it("si Turnstile rechaza, no devuelve clave", async () => {
    mocks.verifyTurnstile.mockResolvedValue(false);
    await expect(verifyHumanRequest(form("token-malo"))).resolves.toEqual({ ok: false });
  });

  it("sin token le pasa null a Turnstile (que lo rechaza sin llamar a Cloudflare)", async () => {
    mocks.verifyTurnstile.mockResolvedValue(false);
    await verifyHumanRequest(form());
    expect(mocks.verifyTurnstile).toHaveBeenCalledWith(null, expect.anything());
  });
});
