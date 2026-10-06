import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderActionState } from "@/lib/admin/order-action-state";

const mocks = vi.hoisted(() => ({ updateOrderStatus: vi.fn() }));
vi.mock("@/app/admin/(panel)/pedidos/[id]/actions", () => ({ updateOrderStatus: mocks.updateOrderStatus }));

const { OrderStatusForm } = await import("./OrderStatusForm");

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";
const select = () => screen.getByLabelText("Nuevo estado") as HTMLSelectElement;
const options = () => [...select().options].map((o) => o.textContent);

afterEach(() => vi.clearAllMocks());

describe("OrderStatusForm", () => {
  it("ofrece solo los estados válidos, el siguiente del flujo primero", () => {
    render(<OrderStatusForm order={{ id: ORDER_ID, status: "confirmed", payment_method: "cash", delivery_method: "pickup" }} />);
    expect(options()).toEqual(["Pagado", "En preparación", "Cancelado"]);
    expect(select().value).toBe("paid");
  });

  it("manda el id del pedido y el estado elegido", async () => {
    mocks.updateOrderStatus.mockResolvedValue({ status: "success", message: "Estado actualizado: Confirmado." });
    render(<OrderStatusForm order={{ id: ORDER_ID, status: "pending", payment_method: "transfer", delivery_method: "pickup" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Cambiar estado" }));

    await waitFor(() => expect(mocks.updateOrderStatus).toHaveBeenCalled());
    const sent: FormData = mocks.updateOrderStatus.mock.calls[0][1];
    expect(sent.get("orderId")).toBe(ORDER_ID);
    expect(sent.get("status")).toBe("confirmed");
    expect((await screen.findByRole("status")).textContent).toBe("Estado actualizado: Confirmado.");
  });

  it("al elegir Cancelado avisa que no se deshace y el botón lo dice", () => {
    render(<OrderStatusForm order={{ id: ORDER_ID, status: "pending", payment_method: "transfer", delivery_method: "pickup" }} />);

    fireEvent.change(select(), { target: { value: "cancelled" } });

    screen.getByText("Cancelar devuelve el stock y no se puede deshacer.");
    screen.getByRole("button", { name: "Cancelar pedido" });
  });

  it("muestra el error del servidor", async () => {
    mocks.updateOrderStatus.mockResolvedValue({ status: "error", message: "El pedido cambió." } satisfies OrderActionState);
    render(<OrderStatusForm order={{ id: ORDER_ID, status: "pending", payment_method: "transfer", delivery_method: "pickup" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Cambiar estado" }));

    expect((await screen.findByRole("alert")).textContent).toBe("El pedido cambió.");
  });

  it("después de un error conserva la opción elegida (decisión 48: React resetea el form)", async () => {
    mocks.updateOrderStatus.mockResolvedValue({ status: "error", message: "No pudimos guardar." } satisfies OrderActionState);
    render(<OrderStatusForm order={{ id: ORDER_ID, status: "pending", payment_method: "transfer", delivery_method: "pickup" }} />);

    fireEvent.change(select(), { target: { value: "cancelled" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));

    await screen.findByRole("alert");
    expect(select().value).toBe("cancelled");
  });

  it("al cerrar el pedido (refresh con el estado nuevo) sigue mostrando la confirmación", async () => {
    mocks.updateOrderStatus.mockResolvedValue({ status: "success", message: "Estado actualizado: Cancelado." });
    const order = { id: ORDER_ID, payment_method: "transfer", delivery_method: "pickup" } as const;
    const { rerender } = render(<OrderStatusForm order={{ ...order, status: "pending" }} />);

    fireEvent.change(select(), { target: { value: "cancelled" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    await screen.findByRole("status");
    // refresh() trae el pedido cancelado: ya no hay opciones.
    rerender(<OrderStatusForm order={{ ...order, status: "cancelled" }} />);

    expect(screen.getByRole("status").textContent).toBe("Estado actualizado: Cancelado.");
    screen.getByText("Este pedido está cerrado.");
  });

  it("un pedido cerrado no ofrece cambios", () => {
    render(<OrderStatusForm order={{ id: ORDER_ID, status: "completed", payment_method: "transfer", delivery_method: "pickup" }} />);
    screen.getByText("Este pedido está cerrado.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
