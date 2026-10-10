// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  CLOSED_REQUESTS_LIMIT,
  CLOSED_REQUEST_STATUSES,
  OPEN_REQUEST_STATUSES,
  countPendingRequests,
  listAdminRequests,
} from "./requests";

type Result = { data?: unknown; count?: number | null; error: unknown };

/** Mismo cliente falso que orders.test.ts: cada from() responde con el resultado que le toca. */
function fakeClient(...results: Result[]) {
  const queries: [string, unknown[]][][] = [];
  const from = vi.fn(() => {
    const calls: [string, unknown[]][] = [];
    const result = results[queries.length] ?? results.at(-1)!;
    queries.push(calls);
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    for (const method of ["select", "order", "limit", "eq", "in"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push([method, args]);
        return builder;
      };
    }
    return builder;
  });
  return { client: { from } as never, from, queries };
}

const rows = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }));

describe("listAdminRequests", () => {
  it("trae todos los abiertos sin tope y los últimos cerrados con tope", async () => {
    const { client, from, queries } = fakeClient(
      { data: rows("abierto", 2), error: null },
      { data: rows("cerrado", 1), error: null },
    );

    await expect(listAdminRequests(client)).resolves.toEqual({
      requests: [...rows("abierto", 2), ...rows("cerrado", 1)],
      closedTruncated: false,
    });

    expect(from).toHaveBeenCalledWith("perfume_requests");
    expect(queries[0]).toContainEqual(["in", ["status", OPEN_REQUEST_STATUSES]]);
    expect(queries[0].some(([method]) => method === "limit")).toBe(false);
    expect(queries[1]).toContainEqual(["in", ["status", CLOSED_REQUEST_STATUSES]]);
    expect(queries[1]).toContainEqual(["limit", [CLOSED_REQUESTS_LIMIT]]);
  });

  it("avisa cuando el historial llegó al tope", async () => {
    const { client } = fakeClient(
      { data: [], error: null },
      { data: rows("cerrado", CLOSED_REQUESTS_LIMIT), error: null },
    );
    await expect(listAdminRequests(client)).resolves.toMatchObject({ closedTruncated: true });
  });

  it("si la base falla, lanza (lo muestra el error boundary del admin)", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } }, { data: [], error: null });
    await expect(listAdminRequests(client)).rejects.toThrow(/encargos.*boom/);
  });
});

describe("countPendingRequests", () => {
  it("cuenta solo los pendientes, sin traer filas", async () => {
    const { client, queries } = fakeClient({ count: 3, error: null });

    await expect(countPendingRequests(client)).resolves.toBe(3);
    expect(queries[0]).toContainEqual(["select", ["id", { count: "exact", head: true }]]);
    expect(queries[0]).toContainEqual(["eq", ["status", "pending"]]);
  });

  // Es un adorno de la navegación: si falla, el panel sigue funcionando sin el número.
  it("si la base falla devuelve 0 en vez de romper la navegación", async () => {
    const { client } = fakeClient({ count: null, error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(countPendingRequests(client)).resolves.toBe(0);
  });
});
