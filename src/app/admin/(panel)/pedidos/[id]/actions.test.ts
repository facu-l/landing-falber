// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ORDER_ERRORS, GENERIC_ADMIN_ORDER_ERROR } from "@/lib/admin/order-errors";
import { SHIPPING_COST_ERRORS } from "@/lib/admin/shipping";
import { formatARS } from "@/lib/format";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, refresh: mocks.refresh }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));

const { setShippingCost, updateOrderStatus } = await import("./actions");

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** update().eq().select() de supabase-js, con la respuesta que da la base. */
function databaseAnswers(result: { data: unknown; error: unknown }) {
  mocks.select.mockResolvedValue(result);
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.update.mockReturnValue({ eq: mocks.eq });
}

beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue({ supabase: { from: () => ({ update: mocks.update }) }, user: { id: "admin" } });
  databaseAnswers({ data: [{ id: ORDER_ID }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("updateOrderStatus", () => {
  it("sin admin no escribe nada (requireAdmin corta con un redirect)", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateOrderStatus({ status: "idle" }, form({ orderId: ORDER_ID, status: "confirmed" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cambia el estado con la sesión del admin y refresca la página", async () => {
    await expect(
      updateOrderStatus({ status: "idle" }, form({ orderId: ORDER_ID, status: "confirmed" })),
    ).resolves.toEqual({ status: "success", message: "Estado actualizado: Confirmado." });

    expect(mocks.update).toHaveBeenCalledWith({ status: "confirmed" });
    expect(mocks.eq).toHaveBeenCalledWith("id", ORDER_ID);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("al cancelar vence el caché del catálogo: el stock volvió (decisión 34)", async () => {
    await updateOrderStatus({ status: "idle" }, form({ orderId: ORDER_ID, status: "cancelled" }));
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
  });

  it("un estado que no existe o un id que no es UUID no llegan a la base", async () => {
    for (const fields of [
      { orderId: ORDER_ID, status: "archivado" },
      { orderId: "FAL-0001", status: "confirmed" },
    ]) {
      await expect(updateOrderStatus({ status: "idle" }, form(fields))).resolves.toMatchObject({ status: "error" });
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si la base rechaza la transición, explica que el pedido cambió", async () => {
    databaseAnswers({ data: null, error: { message: "INVALID_STATUS_TRANSITION", details: "cancelled -> confirmed" } });

    await expect(
      updateOrderStatus({ status: "idle" }, form({ orderId: ORDER_ID, status: "confirmed" })),
    ).resolves.toEqual({ status: "error", message: ADMIN_ORDER_ERRORS.INVALID_STATUS_TRANSITION });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("un error desconocido se loguea y muestra un mensaje genérico", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "fetch failed" };
    databaseAnswers({ data: null, error });

    await expect(
      updateOrderStatus({ status: "idle" }, form({ orderId: ORDER_ID, status: "confirmed" })),
    ).resolves.toEqual({ status: "error", message: GENERIC_ADMIN_ORDER_ERROR });
    expect(log).toHaveBeenCalledWith("[admin] cambiar el estado del pedido falló", error);
  });

  it("si no actualizó ninguna fila (no existe o RLS), lo dice", async () => {
    databaseAnswers({ data: [], error: null });

    const state = await updateOrderStatus({ status: "idle" }, form({ orderId: ORDER_ID, status: "confirmed" }));
    expect(state).toEqual({ status: "error", message: "No encontramos el pedido. Volvé a la lista de pedidos." });
  });
});

describe("setShippingCost", () => {
  it("sin admin no escribe nada", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("guarda el costo en pesos y refresca; no toca el catálogo", async () => {
    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "$ 4.500" })),
    ).resolves.toEqual({ status: "success", message: `Costo de envío guardado: ${formatARS(4500)}.` });

    expect(mocks.update).toHaveBeenCalledWith({ shipping_cost: 4500 });
    expect(mocks.eq).toHaveBeenCalledWith("id", ORDER_ID);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("vacío vuelve a 'a coordinar' (null)", async () => {
    await expect(setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "" }))).resolves.toEqual({
      status: "success",
      message: "Costo de envío borrado: queda a coordinar.",
    });
    expect(mocks.update).toHaveBeenCalledWith({ shipping_cost: null });
  });

  it("un monto mal escrito no llega a la base y conserva lo escrito", async () => {
    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500,50" })),
    ).resolves.toEqual({ status: "error", message: SHIPPING_COST_ERRORS.format, values: { shippingCost: "4500,50" } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si la base lo rechaza (pedido ya enviado), lo explica y conserva lo escrito", async () => {
    databaseAnswers({ data: null, error: { message: "SHIPPING_COST_LOCKED", details: "shipped" } });

    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500" })),
    ).resolves.toEqual({
      status: "error",
      message: ADMIN_ORDER_ERRORS.SHIPPING_COST_LOCKED,
      values: { shippingCost: "4500" },
    });
  });
});
