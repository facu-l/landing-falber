import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY, serializeCart } from "@/lib/cart/cart";
import type { VariantIndex } from "@/lib/cart/resolve";
import type { CheckoutState } from "@/lib/checkout/state";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  replace: vi.fn(),
  turnstileResets: 0,
}));

vi.mock("@/app/(store)/checkout/actions", () => ({ createOrder: mocks.createOrder }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
// El widget real necesita el script de Cloudflare: en el test entrega un token al montarse
// y cuenta los resets (cada resetKey nuevo es un reset).
vi.mock("./Turnstile", () => ({
  Turnstile: ({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) => {
    useEffect(() => {
      if (resetKey > 0) mocks.turnstileResets++;
      onToken(`token-${resetKey}`);
    }, [onToken, resetKey]);
    return null;
  },
}));

const { CheckoutForm } = await import("./CheckoutForm");

const SAUVAGE_5 = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const SAUVAGE_100 = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";
const ORDER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const sauvage = { productName: "Sauvage EDT", brand: "Dior", slug: "dior-sauvage-edt", imagePath: null };
const index: VariantIndex = {
  [SAUVAGE_5]: { ...sauvage, label: "Decant 5 ml", price: 10000, inStock: true },
  [SAUVAGE_100]: { ...sauvage, label: "Frasco 100 ml", price: 250000, inStock: false },
};

function withCart(lines: { variantId: string; quantity: number }[]) {
  localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Nombre y apellido"), { target: { value: "Ana Pérez" } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "221 555 1234" } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Realizar compra" }));
const sentForm = (): FormData => mocks.createOrder.mock.calls.at(-1)![1];

beforeEach(() => {
  mocks.turnstileResets = 0;
  withCart([{ variantId: SAUVAGE_5, quantity: 2 }]);
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("CheckoutForm", () => {
  it("con el carrito vacío invita a ver el catálogo", () => {
    localStorage.clear();
    render(<CheckoutForm index={index} />);
    expect(screen.getByText("Tu carrito está vacío.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Realizar compra" })).toBeNull();
  });

  it("con un producto sin stock manda a revisar el carrito", () => {
    withCart([{ variantId: SAUVAGE_100, quantity: 1 }]);
    render(<CheckoutForm index={index} />);
    expect(screen.getByRole("link", { name: "Revisar el carrito" }).getAttribute("href")).toBe("/carrito");
    expect(screen.queryByRole("button", { name: "Realizar compra" })).toBeNull();
  });

  it("muestra el resumen con el total estimado", () => {
    render(<CheckoutForm index={index} />);
    const summary = screen.getByRole("complementary", { name: "Tu pedido" });
    expect(summary.textContent).toMatch("2 × Sauvage EDT");
    expect(summary.textContent).toMatch(/Total estimado\s*\$\s?20\.000/);
  });

  it("muestra el aviso de uso de datos personales (Ley 25.326)", () => {
    render(<CheckoutForm index={index} />);
    expect(screen.getByText(/Ley 25\.326/)).toBeTruthy();
  });

  it("pide dirección solo para envío, y el efectivo es solo con retiro", () => {
    render(<CheckoutForm index={index} />);
    expect(screen.queryByLabelText("Dirección")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /Efectivo/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Envío a domicilio/ }));

    expect(screen.getByLabelText("Dirección")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Efectivo/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("radio", { name: /Transferencia/ })).toHaveProperty("checked", true);
  });

  it("manda el carrito, un request_id y el token de Turnstile", async () => {
    mocks.createOrder.mockResolvedValue({ status: "success", orderId: ORDER_ID });
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();

    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(1));
    const data = sentForm();
    expect(JSON.parse(data.get("items") as string)).toEqual([{ variantId: SAUVAGE_5, quantity: 2 }]);
    expect(data.get("requestId")).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.get("cf-turnstile-response")).toBe("token-0");
    expect(data.get("fullName")).toBe("Ana Pérez");
    expect(data.get("deliveryMethod")).toBe("pickup");
    expect(data.get("paymentMethod")).toBe("transfer");
  });

  it("deshabilita el botón mientras envía (doble click)", async () => {
    let resolve!: (state: CheckoutState) => void;
    mocks.createOrder.mockReturnValue(new Promise<CheckoutState>((r) => (resolve = r)));
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();

    const button = await screen.findByRole("button", { name: "Enviando pedido" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ status: "success", orderId: ORDER_ID }));
  });

  it("al terminar vacía el carrito y va a la página del pedido", async () => {
    mocks.createOrder.mockResolvedValue({ status: "success", orderId: ORDER_ID });
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/pedido/${ORDER_ID}`));
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("con error muestra los mensajes, conserva lo escrito y pide un token nuevo", async () => {
    mocks.createOrder.mockResolvedValue({
      status: "error",
      message: "No queda stock suficiente de uno de los productos. Revisá tu carrito.",
      fieldErrors: { whatsapp: "Revisá el número: con código de área, sin 0 ni 15 (ej. 221 555 1234)." },
      variantId: SAUVAGE_5,
      values: { fullName: "Ana Pérez", whatsapp: "555" },
    });
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();

    expect((await screen.findByRole("alert")).textContent).toMatch("No queda stock suficiente");
    const whatsapp = screen.getByLabelText("WhatsApp") as HTMLInputElement;
    expect(whatsapp.getAttribute("aria-invalid")).toBe("true");
    expect(whatsapp.value).toBe("555");
    expect((screen.getByLabelText("Nombre y apellido") as HTMLInputElement).value).toBe("Ana Pérez");
    expect(screen.getByRole("complementary", { name: "Tu pedido" }).textContent).toMatch("Sin stock suficiente");
    expect(mocks.turnstileResets).toBe(1);
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull();
  });

  // En el celular el botón queda abajo: sin esto, los errores de arriba quedan fuera de la pantalla.
  it("con errores por campo lleva el foco al primero de la página", async () => {
    mocks.createOrder.mockResolvedValue({
      status: "error",
      fieldErrors: { whatsapp: "Revisá el número.", fullName: "Escribí tu nombre y apellido." },
      values: { fullName: "A", whatsapp: "555" },
    });
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nombre y apellido")));
  });

  it("si el segundo envío vuelve con los mismos errores, el foco vuelve al primero", async () => {
    // Un objeto nuevo por respuesta, como llega de una Server Action real (deserializado).
    mocks.createOrder.mockImplementation(async () => ({
      status: "error",
      fieldErrors: { fullName: "Escribí tu nombre y apellido." },
      values: { fullName: "A" },
    }));
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nombre y apellido")));

    // El cliente se va a otro campo y vuelve a enviar sin corregir.
    (screen.getByLabelText("WhatsApp") as HTMLInputElement).focus();
    submit();

    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nombre y apellido")));
  });

  it("después de un error conserva la entrega y el pago elegidos (el reset del form no los desmarca)", async () => {
    mocks.createOrder.mockResolvedValue({
      status: "error",
      message: "Demasiados intentos. Probá de nuevo en un rato.",
      values: { deliveryMethod: "delivery", paymentMethod: "transfer" },
    });
    render(<CheckoutForm index={index} />);
    fireEvent.click(screen.getByRole("radio", { name: /Envío a domicilio/ }));
    fillValidForm();
    submit();
    await screen.findByRole("alert");

    expect(screen.getByRole("radio", { name: /Envío a domicilio/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: /Retiro en La Plata/ })).toHaveProperty("checked", false);
    expect(screen.getByRole("radio", { name: /Transferencia/ })).toHaveProperty("checked", true);

    // El reintento sale con envío, no con retiro.
    submit();
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(2));
    expect(sentForm().get("deliveryMethod")).toBe("delivery");
  });

  it("si cambia la entrega mientras se envía y vuelve el mismo error, el radio sigue la elección actual", async () => {
    const error = (deliveryMethod: string): CheckoutState => ({
      status: "error",
      message: "Demasiados intentos. Probá de nuevo en un rato.",
      values: { deliveryMethod, paymentMethod: "transfer" },
    });
    mocks.createOrder.mockResolvedValueOnce(error("pickup"));
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();
    await screen.findByRole("alert");

    // Segundo intento con retiro; mientras está pendiente, el cliente elige envío.
    let resolve!: (state: CheckoutState) => void;
    mocks.createOrder.mockReturnValueOnce(new Promise<CheckoutState>((r) => (resolve = r)));
    submit();
    await screen.findByRole("button", { name: "Enviando pedido" });
    fireEvent.click(screen.getByRole("radio", { name: /Envío a domicilio/ }));
    await act(async () => resolve(error("pickup")));

    expect(screen.getByLabelText("Dirección")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Envío a domicilio/ })).toHaveProperty("checked", true);
  });

  it("reintenta con el mismo request_id (si el primer intento llegó a crear el pedido, no se duplica)", async () => {
    mocks.createOrder.mockResolvedValue({ status: "error", message: "Error", values: {} });
    render(<CheckoutForm index={index} />);
    fillValidForm();
    submit();
    await screen.findByRole("alert");
    const first = sentForm().get("requestId");

    fillValidForm();
    submit();
    await waitFor(() => expect(mocks.createOrder).toHaveBeenCalledTimes(2));
    expect(sentForm().get("requestId")).toBe(first);
  });
});
