import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateRequestStatus: vi.fn() }));
vi.mock("@/app/admin/(panel)/encargos/actions", () => ({ updateRequestStatus: mocks.updateRequestStatus }));

const { RequestStatusForm } = await import("./RequestStatusForm");

const REQUEST = { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", status: "pending" as const };

afterEach(() => vi.clearAllMocks());

describe("RequestStatusForm", () => {
  it("ofrece los otros estados, empezando por el siguiente del flujo", () => {
    render(<RequestStatusForm request={REQUEST} />);
    const select = screen.getByLabelText("Estado del encargo") as HTMLSelectElement;

    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Contactado",
      "Cotizado",
      "En búsqueda",
      "Completado",
      "Cancelado",
    ]);
    expect(select.value).toBe("contacted");
  });

  it("manda el id, el estado que se ve (compare-and-set) y el elegido", async () => {
    mocks.updateRequestStatus.mockResolvedValue({ status: "success", message: "Estado actualizado: Cotizado." });
    render(<RequestStatusForm request={REQUEST} />);

    fireEvent.change(screen.getByLabelText("Estado del encargo"), { target: { value: "quoted" } });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    await waitFor(() => expect(mocks.updateRequestStatus).toHaveBeenCalled());
    const sent: FormData = mocks.updateRequestStatus.mock.calls[0][1];
    expect(Object.fromEntries(sent)).toEqual({ requestId: REQUEST.id, fromStatus: "pending", status: "quoted" });
    expect((await screen.findByRole("status")).textContent).toBe("Estado actualizado: Cotizado.");
  });

  it("muestra el error de la acción", async () => {
    mocks.updateRequestStatus.mockResolvedValue({ status: "error", message: "El encargo cambió de estado." });
    render(<RequestStatusForm request={REQUEST} />);

    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("El encargo cambió de estado.");
  });
});
