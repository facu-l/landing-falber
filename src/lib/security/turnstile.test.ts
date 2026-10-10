// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { TURNSTILE_VERIFY_URL, verifyTurnstile } = await import("./turnstile");

const SECRET = "1x0000000000000000000000000000000AA";
const BINDING = { action: "checkout", hostnames: ["falber.com.ar"] } as const;
// Lo que responde Cloudflare con el secreto real a un token del checkout de la tienda.
const REAL_OK = { success: true, action: "checkout", hostname: "falber.com.ar" };

function fakeFetch(body: unknown, init: { status?: number } = {}) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: init.status ?? 200 }));
}

afterEach(() => vi.restoreAllMocks());

describe("verifyTurnstile", () => {
  it("manda token, secreto e IP a Cloudflare y acepta si success es true", async () => {
    const fetchImpl = fakeFetch(REAL_OK);
    await expect(verifyTurnstile("token-ok", { secret: SECRET, ...BINDING, remoteIp: "203.0.113.7", fetchImpl })).resolves.toBe(
      true,
    );

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init?.method).toBe("POST");
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe(SECRET);
    expect(body.get("response")).toBe("token-ok");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("no manda remoteip si la IP es desconocida", async () => {
    const fetchImpl = fakeFetch(REAL_OK);
    await verifyTurnstile("token-ok", { secret: SECRET, ...BINDING, remoteIp: "unknown", fetchImpl });
    expect((fetchImpl.mock.calls[0][1]?.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("rechaza si Cloudflare dice que no", async () => {
    const fetchImpl = fakeFetch({ success: false, "error-codes": ["invalid-input-response"] });
    await expect(verifyTurnstile("token-malo", { secret: SECRET, ...BINDING, fetchImpl })).resolves.toBe(false);
  });

  it("sin token rechaza sin llamar a Cloudflare", async () => {
    const fetchImpl = fakeFetch(REAL_OK);
    await expect(verifyTurnstile("", { secret: SECRET, ...BINDING, fetchImpl })).resolves.toBe(false);
    await expect(verifyTurnstile(null, { secret: SECRET, ...BINDING, fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["Cloudflare caído (500)", () => fakeFetch({}, { status: 500 })],
    ["respuesta que no es JSON", () => vi.fn<typeof fetch>(async () => new Response("<html>"))],
    ["error de red", () => vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("fetch failed")))],
  ])("con %s rechaza (falla cerrado) y lo loguea", async (_, makeFetch) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(verifyTurnstile("token", { secret: SECRET, ...BINDING, fetchImpl: makeFetch() })).resolves.toBe(false);
    expect(log).toHaveBeenCalled();
  });

  describe("atado a la acción y al dominio (decisión 87)", () => {
    it.each([
      ["de otro formulario", { ...REAL_OK, action: "encargo" }],
      ["sin acción", { success: true, hostname: "falber.com.ar" }],
      ["resuelto en otro dominio", { ...REAL_OK, hostname: "deploy-preview-3--falber.netlify.app" }],
      ["sin hostname", { success: true, action: "checkout" }],
    ])("rechaza un token válido %s y lo loguea", async (_, result) => {
      const log = vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(verifyTurnstile("token", { secret: SECRET, ...BINDING, fetchImpl: fakeFetch(result) })).resolves.toBe(
        false,
      );
      expect(log).toHaveBeenCalled();
    });

    it("acepta cualquier hostname de la lista", async () => {
      const fetchImpl = fakeFetch({ ...REAL_OK, hostname: "falber.netlify.app" });
      const hostnames = ["falber.com.ar", "falber.netlify.app"];
      await expect(verifyTurnstile("token", { secret: SECRET, action: "checkout", hostnames, fetchImpl })).resolves.toBe(
        true,
      );
    });

    // Respuesta literal de Cloudflare con el secreto de prueba (local, CI y E2E):
    // sin action y con hostname "example.com", así que no hay nada que atar.
    it("con el secreto de prueba no exige acción ni dominio", async () => {
      const fetchImpl = fakeFetch({
        success: true,
        hostname: "example.com",
        "error-codes": [],
        metadata: { result_with_testing_key: true },
      });
      await expect(verifyTurnstile("token", { secret: SECRET, ...BINDING, fetchImpl })).resolves.toBe(true);
    });

    // El atajo solo puede aceptar lo que Cloudflare ya aprobó: si se mueve antes del
    // chequeo de success o se afloja a "truthy", estos casos lo agarran.
    it.each([
      ["secreto de prueba que siempre falla", { success: false, metadata: { result_with_testing_key: true } }],
      ["marca en false con otra acción", { ...REAL_OK, action: "encargo", metadata: { result_with_testing_key: false } }],
      ["marca que no es booleana con otro dominio", { ...REAL_OK, hostname: "evil.example", metadata: { result_with_testing_key: "true" } }],
    ])("el atajo del secreto de prueba no abre la puerta: %s", async (_, result) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(verifyTurnstile("token", { secret: SECRET, ...BINDING, fetchImpl: fakeFetch(result) })).resolves.toBe(
        false,
      );
    });

    it("compara el dominio sin distinguir mayúsculas", async () => {
      const fetchImpl = fakeFetch({ ...REAL_OK, hostname: "Falber.com.ar" });
      await expect(verifyTurnstile("token", { secret: SECRET, ...BINDING, fetchImpl })).resolves.toBe(true);
    });
  });
});
