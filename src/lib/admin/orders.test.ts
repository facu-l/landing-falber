// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ACTIVE_STATUSES, CLOSED_ORDERS_LIMIT, CLOSED_STATUSES, getAdminOrder, listAdminOrders } from "./orders";

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";

type Result = { data: unknown; error: unknown };

/**
 * Cliente falso: cada from() arma una consulta nueva que responde con el resultado que le
 * toca (en orden). Cada método devuelve el builder; await resuelve el resultado.
 * `queries[i]` guarda las llamadas de la consulta i.
 */
function fakeClient(...results: Result[]) {
  const queries: [string, unknown[]][][] = [];
  const from = vi.fn(() => {
    const calls: [string, unknown[]][] = [];
    const result = results[queries.length] ?? results.at(-1)!;
    queries.push(calls);
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown) => resolve(result),
    };
    for (const method of ["select", "order", "limit", "eq", "in", "maybeSingle"]) {
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

describe("listAdminOrders", () => {
  it("trae todos los pedidos activos sin tope y los últimos cerrados con tope", async () => {
    const { client, queries } = fakeClient({ data: rows("activo", 2), error: null }, { data: rows("cerrado", 1), error: null });

    await expect(listAdminOrders(client)).resolves.toEqual({
      orders: [...rows("activo", 2), ...rows("cerrado", 1)],
      closedTruncated: false,
    });

    const [active, closed] = queries;
    expect(active).toContainEqual(["in", ["status", ACTIVE_STATUSES]]);
    expect(active.some(([method]) => method === "limit")).toBe(false);
    expect(closed).toContainEqual(["in", ["status", CLOSED_STATUSES]]);
    expect(closed).toContainEqual(["limit", [CLOSED_ORDERS_LIMIT]]);
    for (const query of queries) expect(query).toContainEqual(["order", ["created_at", { ascending: false }]]);
  });

  it("activos y cerrados cubren todos los estados, sin repetir", () => {
    expect([...ACTIVE_STATUSES, ...CLOSED_STATUSES].sort()).toEqual(
      ["pending", "confirmed", "paid", "preparing", "ready_for_pickup", "shipped", "completed", "cancelled"].sort(),
    );
  });

  it("avisa cuando los cerrados llegaron al tope (puede haber más viejos)", async () => {
    const { client } = fakeClient({ data: [], error: null }, { data: rows("cerrado", CLOSED_ORDERS_LIMIT), error: null });
    await expect(listAdminOrders(client)).resolves.toMatchObject({ closedTruncated: true });
  });

  it("un error de la base en cualquiera de las dos consultas lanza (lo muestra error.tsx)", async () => {
    const failed = { data: null, error: { message: "fetch failed" } };
    await expect(listAdminOrders(fakeClient(failed, { data: [], error: null }).client)).rejects.toThrow("fetch failed");
    await expect(listAdminOrders(fakeClient({ data: [], error: null }, failed).client)).rejects.toThrow("fetch failed");
  });
});

describe("getAdminOrder", () => {
  it("un id que no es UUID es 'no encontrado', sin consultar", async () => {
    const { client, from } = fakeClient({ data: null, error: null });
    await expect(getAdminOrder(client, "FAL-0001")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("busca por id y devuelve null si no existe (o RLS no lo deja ver)", async () => {
    const { client, queries } = fakeClient({ data: null, error: null });
    await expect(getAdminOrder(client, ORDER_ID)).resolves.toBeNull();
    expect(queries[0]).toContainEqual(["eq", ["id", ORDER_ID]]);
  });

  it("un error de la base lanza", async () => {
    const { client } = fakeClient({ data: null, error: { message: "fetch failed" } });
    await expect(getAdminOrder(client, ORDER_ID)).rejects.toThrow("fetch failed");
  });
});
