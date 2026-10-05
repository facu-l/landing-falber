// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { TURNSTILE_VERIFY_URL, verifyTurnstile } = await import("./turnstile");

const SECRET = "1x0000000000000000000000000000000AA";

function fakeFetch(body: unknown, init: { status?: number } = {}) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: init.status ?? 200 }));
}

afterEach(() => vi.restoreAllMocks());

describe("verifyTurnstile", () => {
  it("manda token, secreto e IP a Cloudflare y acepta si success es true", async () => {
    const fetchImpl = fakeFetch({ success: true });
    await expect(verifyTurnstile("token-ok", { secret: SECRET, remoteIp: "203.0.113.7", fetchImpl })).resolves.toBe(
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
    const fetchImpl = fakeFetch({ success: true });
    await verifyTurnstile("token-ok", { secret: SECRET, remoteIp: "unknown", fetchImpl });
    expect((fetchImpl.mock.calls[0][1]?.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("rechaza si Cloudflare dice que no", async () => {
    const fetchImpl = fakeFetch({ success: false, "error-codes": ["invalid-input-response"] });
    await expect(verifyTurnstile("token-malo", { secret: SECRET, fetchImpl })).resolves.toBe(false);
  });

  it("sin token rechaza sin llamar a Cloudflare", async () => {
    const fetchImpl = fakeFetch({ success: true });
    await expect(verifyTurnstile("", { secret: SECRET, fetchImpl })).resolves.toBe(false);
    await expect(verifyTurnstile(null, { secret: SECRET, fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["Cloudflare caído (500)", () => fakeFetch({}, { status: 500 })],
    ["respuesta que no es JSON", () => vi.fn<typeof fetch>(async () => new Response("<html>"))],
    ["error de red", () => vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("fetch failed")))],
  ])("con %s rechaza (falla cerrado) y lo loguea", async (_, makeFetch) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(verifyTurnstile("token", { secret: SECRET, fetchImpl: makeFetch() })).resolves.toBe(false);
    expect(log).toHaveBeenCalled();
  });
});
