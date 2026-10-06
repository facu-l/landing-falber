// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getAdminOrder, listAdminOrders, ORDER_LIST_LIMIT } from "./orders";

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";

/** Cliente falso: cada método del query builder devuelve el builder; await resuelve `result`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  for (const method of ["select", "order", "limit", "eq", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  const from = vi.fn(() => builder);
  return { client: { from } as never, from, calls };
}

describe("listAdminOrders", () => {
  it("trae los pedidos más recientes con un tope", async () => {
    const { client, from, calls } = fakeClient({ data: [], error: null });

    await expect(listAdminOrders(client)).resolves.toEqual([]);

    expect(from).toHaveBeenCalledWith("orders");
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
    expect(calls).toContainEqual(["limit", [ORDER_LIST_LIMIT]]);
  });

  it("un error de la base lanza (lo muestra error.tsx)", async () => {
    const { client } = fakeClient({ data: null, error: { message: "fetch failed" } });
    await expect(listAdminOrders(client)).rejects.toThrow("fetch failed");
  });
});

describe("getAdminOrder", () => {
  it("un id que no es UUID es 'no encontrado', sin consultar", async () => {
    const { client, from } = fakeClient({ data: null, error: null });
    await expect(getAdminOrder(client, "FAL-0001")).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("busca por id y devuelve null si no existe (o RLS no lo deja ver)", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await expect(getAdminOrder(client, ORDER_ID)).resolves.toBeNull();
    expect(calls).toContainEqual(["eq", ["id", ORDER_ID]]);
  });

  it("un error de la base lanza", async () => {
    const { client } = fakeClient({ data: null, error: { message: "fetch failed" } });
    await expect(getAdminOrder(client, ORDER_ID)).rejects.toThrow("fetch failed");
  });
});
