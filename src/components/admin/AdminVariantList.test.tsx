import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VARIANT_ERRORS, type VariantFormState } from "@/lib/admin/product-variants";

const mocks = vi.hoisted(() => ({ updateVariant: vi.fn() }));
vi.mock("@/app/admin/(panel)/productos/[id]/variant-actions", () => ({ updateVariant: mocks.updateVariant }));

const { AdminVariantList } = await import("./AdminVariantList");

const variant = (id: string, over: Partial<{ variant_type: "decant" | "full_bottle"; size_ml: number; label: string; price: number; stock: number; is_available: boolean }>) => ({
  id,
  variant_type: "decant" as const,
  size_ml: 5,
  label: "Decant 5 ml",
  price: 12000,
  stock: 8,
  is_available: true,
  ...over,
});

const VARIANTS = [
  variant("v-off", { size_ml: 3, label: "Decant 3 ml", is_available: false, stock: 2 }),
  variant("v-bottle", { variant_type: "full_bottle", size_ml: 100, label: "Frasco 100 ml", price: 180000, stock: 0 }),
  variant("v-5", {}),
];

afterEach(() => vi.clearAllMocks());

describe("AdminVariantList", () => {
  it("sin presentaciones dice cómo seguir", () => {
    render(<AdminVariantList variants={[]} />);
    expect(screen.getByText("Sin presentaciones. Agregá la primera abajo.")).toBeTruthy();
  });

  it("disponibles primero con precio y stock; las no disponibles al final", () => {
    render(<AdminVariantList variants={VARIANTS} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => within(row).getByRole("heading").textContent)).toEqual([
      "Decant 5 ml",
      "Frasco 100 ml",
      "Decant 3 ml",
    ]);
    expect(within(rows[0]).getByText("8 u.")).toBeTruthy();
    expect(within(rows[0]).getByText(/12\.000/)).toBeTruthy();
    expect(within(rows[1]).getByText("Agotado")).toBeTruthy();
    expect(within(rows[2]).getByText("No disponible")).toBeTruthy();
  });

  it("Editar despliega el formulario de esa fila, de a uno por vez", () => {
    render(<AdminVariantList variants={VARIANTS} />);
    const edit5 = screen.getByRole("button", { name: "Editar Decant 5 ml" });
    expect(edit5.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(edit5);
    expect(edit5.getAttribute("aria-expanded")).toBe("true");
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("12000");
    expect((screen.getByLabelText("Disponible") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Editar Frasco 100 ml" }));
    expect(screen.getAllByLabelText("Precio")).toHaveLength(1);
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("180000");
    expect(edit5.getAttribute("aria-expanded")).toBe("false");
  });

  it("Cancelar cierra el formulario", () => {
    render(<AdminVariantList variants={VARIANTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Decant 5 ml" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Precio")).toBeNull();
  });

  it("después de un error marca el precio y conserva lo escrito, también Disponible", async () => {
    mocks.updateVariant.mockResolvedValue({
      status: "error",
      fieldErrors: { price: VARIANT_ERRORS.priceZero },
      values: { price: "0" },
    } satisfies VariantFormState);
    render(<AdminVariantList variants={VARIANTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Decant 5 ml" }));
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("Disponible"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await screen.findByText(VARIANT_ERRORS.priceZero);
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("0");
    expect((screen.getByLabelText("Disponible") as HTMLInputElement).checked).toBe(false);
  });

  it("al guardar avisa y Cancelar pasa a Cerrar", async () => {
    mocks.updateVariant.mockResolvedValue({ status: "success", message: "Presentación guardada." } satisfies VariantFormState);
    render(<AdminVariantList variants={VARIANTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Decant 5 ml" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect((await screen.findByRole("status")).textContent).toBe("Presentación guardada.");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
  });
});
