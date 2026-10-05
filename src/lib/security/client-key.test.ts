// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { clientIp, hashClientKey } = await import("./client-key");

describe("clientIp", () => {
  it("prefiere la IP que pone Netlify (el cliente no la puede falsificar)", () => {
    const headers = new Headers({
      "x-nf-client-connection-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 10.0.0.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("sin Netlify (local, CI) usa el primer valor de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" }))).toBe("198.51.100.1");
  });

  it("sin ningún header devuelve 'unknown' (todos comparten el mismo límite)", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashClientKey", () => {
  const secret = "s".repeat(64);

  it("es estable para la misma IP y secreto", () => {
    expect(hashClientKey("203.0.113.7", secret)).toBe(hashClientKey("203.0.113.7", secret));
  });

  it("no contiene la IP y cumple el largo mínimo de la base (16)", () => {
    const key = hashClientKey("203.0.113.7", secret);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203");
  });

  it("cambia con otra IP o con otro secreto", () => {
    const key = hashClientKey("203.0.113.7", secret);
    expect(hashClientKey("203.0.113.8", secret)).not.toBe(key);
    expect(hashClientKey("203.0.113.7", "t".repeat(64))).not.toBe(key);
  });

  it("falla sin un secreto de verdad (sin secreto, el hash de una IP se revierte probando todas)", () => {
    expect(() => hashClientKey("203.0.113.7", "")).toThrow(/IP_HASH_SECRET/);
    expect(() => hashClientKey("203.0.113.7", "corto")).toThrow(/IP_HASH_SECRET/);
  });
});
