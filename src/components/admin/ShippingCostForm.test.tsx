import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderActionState } from "@/lib/admin/order-action-state";

const mocks = vi.hoisted(() => ({ setShippingCost: vi.fn() }));
vi.mock("@/app/admin/(panel)/pedidos/[id]/actions", () => ({ setShippingCost: mocks.setShippingCost }));

const { ShippingCostForm } = await import("./ShippingCostForm");

const ORDER_ID = "f060303b-8447-45e5-ab0c-c59cd1705419";
const field = () => screen.getByLabelText("Costo de envío") as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: "Guardar costo" }));

afterEach(() => vi.clearAllMocks());

describe("ShippingCostForm", () => {
  it("arranca con el costo actual (o vacío si está a coordinar)", () => {
    const { unmount } = render(<ShippingCostForm orderId={ORDER_ID} shippingCost={3500} />);
    expect(field().value).toBe("3500");
    unmount();

    render(<ShippingCostForm orderId={ORDER_ID} shippingCost={null} />);
    expect(field().value).toBe("");
  });

  it("manda el id del pedido y lo escrito", async () => {
    mocks.setShippingCost.mockResolvedValue({ status: "success", message: "Costo de envío guardado." });
    render(<ShippingCostForm orderId={ORDER_ID} shippingCost={null} />);

    fireEvent.change(field(), { target: { value: "4.500" } });
    save();

    await waitFor(() => expect(mocks.setShippingCost).toHaveBeenCalled());
    const sent: FormData = mocks.setShippingCost.mock.calls[0][1];
    expect(sent.get("orderId")).toBe(ORDER_ID);
    expect(sent.get("shippingCost")).toBe("4.500");
    expect((await screen.findByRole("status")).textContent).toBe("Costo de envío guardado.");
  });

  it("un error se muestra en el campo y conserva lo escrito", async () => {
    mocks.setShippingCost.mockResolvedValue({
      status: "error",
      message: "Escribí el costo en pesos, sin centavos (ej. 4500 o 4.500).",
      values: { shippingCost: "4500,50" },
    } satisfies OrderActionState);
    render(<ShippingCostForm orderId={ORDER_ID} shippingCost={null} />);

    fireEvent.change(field(), { target: { value: "4500,50" } });
    save();

    await waitFor(() => expect(field().getAttribute("aria-invalid")).toBe("true"));
    screen.getByText("Escribí el costo en pesos, sin centavos (ej. 4500 o 4.500).");
    expect(field().value).toBe("4500,50");
  });
});
