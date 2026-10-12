import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VARIANT_ERRORS, type VariantFormState, variantCreatedWithoutStock } from "@/lib/admin/product-variants";

const mocks = vi.hoisted(() => ({ addVariant: vi.fn() }));
vi.mock("@/app/admin/(panel)/productos/[id]/variant-actions", () => ({ addVariant: mocks.addVariant }));

const { AddVariantForm } = await import("./AddVariantForm");

const decant = (size_ml: number) => ({ variant_type: "decant" as const, size_ml });

const field = <T extends HTMLElement = HTMLInputElement>(label: string) => screen.getByLabelText(label) as T;
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Agregar presentación" }));

afterEach(() => vi.clearAllMocks());

describe("AddVariantForm", () => {
  it("arranca en Decant con el primer tamaño libre y los ocupados deshabilitados", () => {
    render(<AddVariantForm productId="p1" existing={[decant(3)]} />);
    expect((screen.getByRole("radio", { name: /Decant/ }) as HTMLInputElement).checked).toBe(true);
    expect(field<HTMLSelectElement>("Tamaño").value).toBe("5");
    expect((screen.getByRole("option", { name: "3 ml (ya está)" }) as HTMLOptionElement).disabled).toBe(true);
    expect(screen.getByText("El tipo y los ml no se cambian después.")).toBeTruthy();
  });

  it("con Frasco pide los ml a mano", () => {
    render(<AddVariantForm productId="p1" existing={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: /Frasco/ }));
    expect(screen.queryByLabelText("Tamaño")).toBeNull();
    expect(field("ml del frasco").getAttribute("name")).toBe("sizeMl");
  });

  it("con los tres decants cargados arranca en Frasco y Decant queda deshabilitado", () => {
    render(<AddVariantForm productId="p1" existing={[decant(3), decant(5), decant(10)]} />);
    expect((screen.getByRole("radio", { name: /Frasco/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Decant/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it("después de un error por campo lo marca, enfoca y conserva lo escrito", async () => {
    mocks.addVariant.mockResolvedValue({
      status: "error",
      fieldErrors: { price: VARIANT_ERRORS.priceRequired },
      values: { variantType: "full_bottle", sizeMl: "100", price: "", initialStock: "2" },
    } satisfies VariantFormState);
    render(<AddVariantForm productId="p1" existing={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: /Frasco/ }));
    fireEvent.change(field("ml del frasco"), { target: { value: "100" } });
    fireEvent.change(field("Stock inicial"), { target: { value: "2" } });
    submit();

    await screen.findByText(VARIANT_ERRORS.priceRequired);
    expect(field("Precio").getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(field("Precio")));
    expect((screen.getByRole("radio", { name: /Frasco/ }) as HTMLInputElement).checked).toBe(true);
    expect(field("ml del frasco").value).toBe("100");
    expect(field("Stock inicial").value).toBe("2");
  });

  it("al guardar avisa, queda abierto y vuelve el foco a Precio", async () => {
    mocks.addVariant.mockResolvedValue({ status: "success", message: "Se agregó Decant 5 ml." } satisfies VariantFormState);
    render(<AddVariantForm productId="p1" existing={[]} />);
    fireEvent.change(field("Precio"), { target: { value: "12000" } });
    submit();

    expect((await screen.findByRole("status")).textContent).toBe("Se agregó Decant 5 ml.");
    await waitFor(() => expect(document.activeElement).toBe(field("Precio")));
    expect(screen.getByRole("button", { name: "Agregar presentación" })).toBeTruthy();
  });

  it("el fallo parcial se anuncia como alerta (decisión 100)", async () => {
    const message = variantCreatedWithoutStock("Decant 5 ml");
    mocks.addVariant.mockResolvedValue({ status: "partial", message } satisfies VariantFormState);
    render(<AddVariantForm productId="p1" existing={[]} />);
    fireEvent.change(field("Precio"), { target: { value: "12000" } });
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });
});
