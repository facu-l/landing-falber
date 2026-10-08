import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShippingEstimatesState } from "@/lib/admin/shipping-estimates";

const mocks = vi.hoisted(() => ({ updateShippingEstimates: vi.fn() }));
vi.mock("@/app/admin/(panel)/envios/actions", () => ({ updateShippingEstimates: mocks.updateShippingEstimates }));

const { ShippingEstimatesForm } = await import("./ShippingEstimatesForm");

const field = (label: string) => screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

afterEach(() => vi.clearAllMocks());

describe("ShippingEstimatesForm", () => {
  it("arranca con los montos guardados", () => {
    render(<ShippingEstimatesForm estimates={{ toBranch: 7000, toHome: 9000 }} />);
    expect(field("Envío estimado a sucursal").value).toBe("7000");
    expect(field("Envío estimado a domicilio").value).toBe("9000");
  });

  it("manda los dos montos y muestra la confirmación", async () => {
    mocks.updateShippingEstimates.mockResolvedValue({
      status: "success",
      message: "Envíos estimados guardados.",
    } satisfies ShippingEstimatesState);
    render(<ShippingEstimatesForm estimates={{ toBranch: 7000, toHome: 9000 }} />);

    fireEvent.change(field("Envío estimado a domicilio"), { target: { value: "9.500" } });
    save();

    await waitFor(() => expect(mocks.updateShippingEstimates).toHaveBeenCalled());
    const sent: FormData = mocks.updateShippingEstimates.mock.calls[0][1];
    expect(sent.get("toBranch")).toBe("7000");
    expect(sent.get("toHome")).toBe("9.500");
    expect((await screen.findByRole("status")).textContent).toBe("Envíos estimados guardados.");
  });

  it("los errores van en su campo y se conserva lo escrito", async () => {
    mocks.updateShippingEstimates.mockResolvedValue({
      status: "error",
      fieldErrors: { toBranch: "Escribí el envío estimado en pesos (ej. 7000 o 7.000)." },
      values: { toBranch: "", toHome: "9.500" },
    } satisfies ShippingEstimatesState);
    render(<ShippingEstimatesForm estimates={{ toBranch: 7000, toHome: 9000 }} />);

    fireEvent.change(field("Envío estimado a sucursal"), { target: { value: "" } });
    save();

    await screen.findByText("Escribí el envío estimado en pesos (ej. 7000 o 7.000).");
    expect(field("Envío estimado a sucursal").getAttribute("aria-invalid")).toBe("true");
    expect(field("Envío estimado a domicilio").value).toBe("9.500");
  });

  it("un error general (sin campo) se muestra como alerta", async () => {
    mocks.updateShippingEstimates.mockResolvedValue({
      status: "error",
      message: "No pudimos guardar el cambio. Probá de nuevo en unos segundos.",
      values: { toBranch: "7000", toHome: "9000" },
    } satisfies ShippingEstimatesState);
    render(<ShippingEstimatesForm estimates={{ toBranch: 7000, toHome: 9000 }} />);

    save();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No pudimos guardar el cambio. Probá de nuevo en unos segundos.",
    );
  });
});
