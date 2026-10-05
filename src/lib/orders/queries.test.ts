// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ rpc }) }));

const { getOrderSummary } = await import("./queries");

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";

afterEach(() => vi.clearAllMocks());

describe("getOrderSummary", () => {
  it("llama a get_order_summary con el id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await getOrderSummary(ORDER_ID);
    expect(rpc).toHaveBeenCalledWith("get_order_summary", { p_order_id: ORDER_ID });
  });

  it("un id que no es UUID es 'no encontrado', sin consultar (Postgres respondería 400)", async () => {
    await expect(getOrderSummary("FAL-0002")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("un pedido inexistente devuelve null", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(getOrderSummary(ORDER_ID)).resolves.toBeNull();
  });

  it("un error de la base se propaga (lo muestra error.tsx, no un 404 falso)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    await expect(getOrderSummary(ORDER_ID)).rejects.toThrow(/connection refused/);
  });
});
