// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ORDER_ERRORS, GENERIC_ADMIN_ORDER_ERROR, ORDER_CHANGED, ORDER_NOT_FOUND } from "@/lib/admin/order-errors";
import { SHIPPING_COST_ERRORS } from "@/lib/admin/shipping";
import { formatARS } from "@/lib/format";

const mocks = vi.hoisted(() => ({
  requireAdminAction: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, refresh: mocks.refresh }));
vi.mock("@/lib/admin/auth", () => ({ requireAdminAction: mocks.requireAdminAction }));

const { setShippingCost, updateOrderStatus } = await import("./actions");

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";
// Lo que devuelve requireAdminAction cuando Auth o is_admin no responden.
const ACCESS_FAILED = { ok: false, message: "No pudimos verificar tu acceso." } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** update().eq()[.eq()].select() de supabase-js, con la respuesta que da la base. */
function databaseAnswers(result: { data: unknown; error: unknown }) {
  mocks.select.mockResolvedValue(result);
  const filters = { eq: mocks.eq, select: mocks.select };
  mocks.eq.mockReturnValue(filters);
  mocks.update.mockReturnValue(filters);
}

beforeEach(() => {
  mocks.requireAdminAction.mockResolvedValue({
    ok: true,
    supabase: { from: () => ({ update: mocks.update }) },
    user: { id: "admin" },
  });
  databaseAnswers({ data: [{ id: ORDER_ID }], error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("updateOrderStatus", () => {
  // El form manda el estado que el admin estaba viendo (fromStatus) y el elegido (status).
  const change = (status: string, fromStatus = "pending") => form({ orderId: ORDER_ID, fromStatus, status });

  it("sin admin no escribe nada (requireAdminAction corta con un redirect)", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(updateOrderStatus({ status: "idle" }, change("confirmed"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no se pudo verificar el acceso, vuelve al formulario sin escribir nada", async () => {
    mocks.requireAdminAction.mockResolvedValue(ACCESS_FAILED);

    await expect(updateOrderStatus({ status: "idle" }, change("confirmed"))).resolves.toEqual({
      status: "error",
      message: ACCESS_FAILED.message,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("cambia el estado solo si el pedido sigue en el estado que el admin veía, y refresca", async () => {
    await expect(updateOrderStatus({ status: "idle" }, change("confirmed"))).resolves.toEqual({
      status: "success",
      message: "Estado actualizado: Confirmado.",
    });

    expect(mocks.update).toHaveBeenCalledWith({ status: "confirmed" });
    expect(mocks.eq).toHaveBeenCalledWith("id", ORDER_ID);
    expect(mocks.eq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("si el pedido cambió desde otra pestaña (0 filas), no lo pisa y pide recargar", async () => {
    // Ej.: la pestaña vieja muestra 'pending', pero ya está 'paid'. Cancelar no puede pasar.
    databaseAnswers({ data: [], error: null });

    await expect(updateOrderStatus({ status: "idle" }, change("cancelled"))).resolves.toEqual({
      status: "error",
      message: ORDER_CHANGED,
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("al cancelar vence el caché del catálogo: el stock volvió (decisión 34)", async () => {
    await updateOrderStatus({ status: "idle" }, change("cancelled"));
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
  });

  it("una cancelación que la base rechaza no vence el catálogo: el stock no se movió", async () => {
    databaseAnswers({ data: null, error: { message: "INVALID_STATUS_TRANSITION", details: "completed -> cancelled" } });

    await expect(updateOrderStatus({ status: "idle" }, change("cancelled", "completed"))).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("re-guardar el mismo estado no llega a la base", async () => {
    await expect(updateOrderStatus({ status: "idle" }, change("pending", "pending"))).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("un estado que no existe, un estado de origen que falta o un id que no es UUID no llegan a la base", async () => {
    const invalid: Record<string, string>[] = [
      { orderId: ORDER_ID, fromStatus: "pending", status: "archivado" },
      { orderId: ORDER_ID, status: "confirmed" },
      { orderId: "FAL-0001", fromStatus: "pending", status: "confirmed" },
    ];
    for (const fields of invalid) {
      await expect(updateOrderStatus({ status: "idle" }, form(fields))).resolves.toMatchObject({ status: "error" });
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si la base rechaza la transición, explica que el pedido cambió", async () => {
    databaseAnswers({ data: null, error: { message: "INVALID_STATUS_TRANSITION", details: "cancelled -> confirmed" } });

    await expect(updateOrderStatus({ status: "idle" }, change("confirmed"))).resolves.toEqual({
      status: "error",
      message: ADMIN_ORDER_ERRORS.INVALID_STATUS_TRANSITION,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("un error desconocido se loguea y muestra un mensaje genérico", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { message: "fetch failed" };
    databaseAnswers({ data: null, error });

    await expect(updateOrderStatus({ status: "idle" }, change("confirmed"))).resolves.toEqual({
      status: "error",
      message: GENERIC_ADMIN_ORDER_ERROR,
    });
    expect(log).toHaveBeenCalledWith("[admin] cambiar el estado del pedido falló", error);
  });

  it("loguea solo el código y el mensaje del error, nunca details (la fila con datos del cliente)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseAnswers({
      data: null,
      error: { message: "new row violates check constraint", code: "23514", details: "Failing row contains (Ana Pérez, Calle 7 123)" },
    });

    await updateOrderStatus({ status: "idle" }, change("confirmed"));

    expect(log).toHaveBeenCalledWith("[admin] cambiar el estado del pedido falló", {
      code: "23514",
      message: "new row violates check constraint",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("Ana Pérez");
  });
});

describe("setShippingCost", () => {
  it("sin admin no escribe nada", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no se pudo verificar el acceso, vuelve al formulario con lo escrito y sin escribir nada", async () => {
    mocks.requireAdminAction.mockResolvedValue(ACCESS_FAILED);

    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500" })),
    ).resolves.toEqual({ status: "error", message: ACCESS_FAILED.message, values: { shippingCost: "4500" } });
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

  it("un id que no es UUID no llega a la base y conserva lo escrito", async () => {
    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: "FAL-0001", shippingCost: "4500" })),
    ).resolves.toEqual({ status: "error", message: ORDER_NOT_FOUND, values: { shippingCost: "4500" } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no tocó ninguna fila (no existe o RLS), avisa que no encontró el pedido", async () => {
    databaseAnswers({ data: [], error: null });

    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500" })),
    ).resolves.toEqual({ status: "error", message: ORDER_NOT_FOUND, values: { shippingCost: "4500" } });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("un error desconocido se loguea, muestra un mensaje genérico y conserva lo escrito", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseAnswers({
      data: null,
      error: { message: "new row violates check constraint", code: "23514", details: "Failing row contains (Ana Pérez)" },
    });

    await expect(
      setShippingCost({ status: "idle" }, form({ orderId: ORDER_ID, shippingCost: "4500" })),
    ).resolves.toEqual({ status: "error", message: GENERIC_ADMIN_ORDER_ERROR, values: { shippingCost: "4500" } });
    // Solo código y mensaje: details trae la fila con datos del cliente.
    expect(log).toHaveBeenCalledWith("[admin] cargar el costo de envío falló", {
      code: "23514",
      message: "new row violates check constraint",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("Ana Pérez");
  });
});
