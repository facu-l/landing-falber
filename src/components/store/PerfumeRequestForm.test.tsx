import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Activity, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestPrefill } from "@/lib/requests/prefill";
import type { RequestState } from "@/lib/requests/state";

const mocks = vi.hoisted(() => ({
  createPerfumeRequest: vi.fn(),
  turnstileResets: 0,
}));

vi.mock("@/app/(store)/encargos/actions", () => ({ createPerfumeRequest: mocks.createPerfumeRequest }));
// Sin el script de Cloudflare: entrega un token al montarse y cuenta los resets.
vi.mock("./Turnstile", () => ({
  Turnstile: ({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) => {
    useEffect(() => {
      if (resetKey > 0) mocks.turnstileResets++;
      onToken(`token-${resetKey}`);
    }, [onToken, resetKey]);
    return null;
  },
}));

const { PerfumeRequestForm } = await import("./PerfumeRequestForm");

const SAUVAGE_10 = "0b6f9c1e-6a3e-4c55-9d0f-3b1f6f1d2a01";
const SAUVAGE_100 = "5d2e8f3a-1c4b-4e7a-8f60-9a2b3c4d5e02";

const sauvage: RequestPrefill = {
  perfumeName: "Sauvage EDT",
  brand: "Dior",
  variants: [
    { id: SAUVAGE_10, label: "Decant 10 ml" },
    { id: SAUVAGE_100, label: "Frasco 100 ml" },
  ],
};

const field = (label: string) => screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

function fillCustomer() {
  type("Nombre y apellido", "Ana Pérez");
  type("WhatsApp", "221 555 1234");
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Enviar encargo" }));
const sentForm = (): FormData => mocks.createPerfumeRequest.mock.calls.at(-1)![1];

beforeEach(() => {
  mocks.turnstileResets = 0;
});

afterEach(() => vi.clearAllMocks());

describe("PerfumeRequestForm sin producto (encargo libre)", () => {
  it("pide perfume, marca y presentación escritos a mano", () => {
    render(<PerfumeRequestForm prefill={null} />);
    expect(field("Perfume").value).toBe("");
    expect(field("Perfume").readOnly).toBe(false);
    expect(field("Marca").value).toBe("");
    expect(field("Presentación").tagName).toBe("INPUT");
  });

  it("manda lo escrito y el token de Turnstile, sin variante", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({ status: "success", perfumeName: "Oud Wood" });
    render(<PerfumeRequestForm prefill={null} />);
    type("Perfume", "Oud Wood");
    type("Marca", "Tom Ford");
    type("Presentación", "Decant 10 ml");
    fillCustomer();
    submit();

    await waitFor(() => expect(mocks.createPerfumeRequest).toHaveBeenCalledTimes(1));
    const data = sentForm();
    expect(data.get("perfumeName")).toBe("Oud Wood");
    expect(data.get("brand")).toBe("Tom Ford");
    expect(data.get("presentation")).toBe("Decant 10 ml");
    expect(data.get("fullName")).toBe("Ana Pérez");
    expect(data.get("cf-turnstile-response")).toBe("token-0");
    expect(data.get("variantId")).toBeNull();
  });
});

describe("PerfumeRequestForm desde un producto (?producto=<slug>)", () => {
  it("precarga perfume y marca de solo lectura y ofrece pedir otro", () => {
    render(<PerfumeRequestForm prefill={sauvage} />);
    expect(field("Perfume").value).toBe("Sauvage EDT");
    expect(field("Perfume").readOnly).toBe(true);
    expect(field("Marca").value).toBe("Dior");
    expect(field("Marca").readOnly).toBe(true);
    expect(screen.getByRole("link", { name: /otro perfume/ }).getAttribute("href")).toBe("/encargos");
  });

  it("la presentación se elige entre las agotadas y manda su variante y su nombre", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({ status: "success", perfumeName: "Sauvage EDT" });
    render(<PerfumeRequestForm prefill={sauvage} />);
    const select = screen.getByLabelText("Presentación") as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["Decant 10 ml", "Frasco 100 ml"]);

    fireEvent.change(select, { target: { value: SAUVAGE_100 } });
    fillCustomer();
    submit();

    await waitFor(() => expect(mocks.createPerfumeRequest).toHaveBeenCalledTimes(1));
    expect(sentForm().get("variantId")).toBe(SAUVAGE_100);
    expect(sentForm().get("presentation")).toBe("Frasco 100 ml");
    expect(sentForm().get("perfumeName")).toBe("Sauvage EDT");
  });

  it("si el producto no tiene presentaciones agotadas, la presentación se escribe a mano", () => {
    render(<PerfumeRequestForm prefill={{ ...sauvage, variants: [] }} />);
    expect(field("Presentación").tagName).toBe("INPUT");
    expect(field("Perfume").value).toBe("Sauvage EDT");
  });
});

describe("PerfumeRequestForm al enviar", () => {
  it("muestra el aviso de uso de datos personales (Ley 25.326)", () => {
    render(<PerfumeRequestForm prefill={null} />);
    expect(screen.getByText(/Ley 25\.326/)).toBeTruthy();
  });

  it("deshabilita el botón mientras envía (doble click)", async () => {
    let resolve!: (state: RequestState) => void;
    mocks.createPerfumeRequest.mockReturnValue(new Promise<RequestState>((r) => (resolve = r)));
    render(<PerfumeRequestForm prefill={sauvage} />);
    fillCustomer();
    submit();

    const button = await screen.findByRole("button", { name: "Enviando encargo" });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(mocks.createPerfumeRequest).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ status: "success", perfumeName: "Sauvage EDT" }));
  });

  it("al terminar confirma en la misma página y dice el próximo paso", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({ status: "success", perfumeName: "Sauvage EDT" });
    render(<PerfumeRequestForm prefill={sauvage} />);
    fillCustomer();
    submit();

    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toMatch("Sauvage EDT");
    expect(confirmation.textContent).toMatch(/te escribimos por WhatsApp/i);
    expect(confirmation.textContent).not.toMatch(/[!¡]/);
    expect(screen.queryByRole("button", { name: "Enviar encargo" })).toBeNull();
  });

  it("si Next esconde la página (Activity) después de un encargo, al volver muestra el formulario vacío", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({ status: "success", perfumeName: "Sauvage EDT" });
    const { rerender } = render(
      <Activity mode="visible">
        <PerfumeRequestForm prefill={null} />
      </Activity>,
    );
    type("Perfume", "Sauvage EDT");
    fillCustomer();
    submit();
    await screen.findByRole("status");

    rerender(
      <Activity mode="hidden">
        <PerfumeRequestForm prefill={null} />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <PerfumeRequestForm prefill={null} />
      </Activity>,
    );

    // El reset corre en una transición: hay que esperarlo.
    expect(((await screen.findByLabelText("Perfume", { exact: true })) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("en un encargo libre la confirmación se queda (no se resetea sola en el próximo render)", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({ status: "success", perfumeName: "Oud Wood" });
    render(<PerfumeRequestForm prefill={null} />);
    type("Perfume", "Oud Wood");
    fillCustomer();
    submit();

    await screen.findByRole("status");
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.getByRole("status").textContent).toMatch("Oud Wood");
  });

  it("si Next esconde la página a mitad de un borrador, lo escrito se conserva", () => {
    const { rerender } = render(
      <Activity mode="visible">
        <PerfumeRequestForm prefill={null} />
      </Activity>,
    );
    type("Perfume", "Borrador");

    rerender(
      <Activity mode="hidden">
        <PerfumeRequestForm prefill={null} />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <PerfumeRequestForm prefill={null} />
      </Activity>,
    );

    expect(field("Perfume").value).toBe("Borrador");
  });

  it("con error muestra los mensajes, conserva lo escrito y pide un token nuevo", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({
      status: "error",
      message: "Demasiados intentos. Probá de nuevo en un rato.",
      fieldErrors: { whatsapp: "Revisá el número: con código de área, sin 0 ni 15 (ej. 221 555 1234)." },
      values: { perfumeName: "Oud Wood", fullName: "Ana Pérez", whatsapp: "555", note: "Urgente" },
    });
    render(<PerfumeRequestForm prefill={null} />);
    type("Perfume", "Oud Wood");
    fillCustomer();
    submit();

    expect((await screen.findByRole("alert")).textContent).toMatch("Demasiados intentos");
    expect(field("WhatsApp").getAttribute("aria-invalid")).toBe("true");
    expect(field("WhatsApp").value).toBe("555");
    expect(field("Perfume").value).toBe("Oud Wood");
    expect(field("Aclaración").value).toBe("Urgente");
    expect(mocks.turnstileResets).toBe(1);
  });

  it("con errores por campo lleva el foco al primero de la página", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({
      status: "error",
      fieldErrors: { whatsapp: "Revisá el número.", perfumeName: "Escribí el perfume." },
      values: { perfumeName: "", fullName: "Ana Pérez", whatsapp: "555" },
    });
    render(<PerfumeRequestForm prefill={null} />);
    fillCustomer();
    submit();

    await waitFor(() => expect(document.activeElement).toBe(field("Perfume")));
  });

  it("si cambia la presentación mientras se envía, después del error el select y la etiqueta siguen la elección actual", async () => {
    let resolve!: (state: RequestState) => void;
    mocks.createPerfumeRequest.mockReturnValueOnce(new Promise<RequestState>((r) => (resolve = r)));
    render(<PerfumeRequestForm prefill={sauvage} />);
    fillCustomer();
    submit();
    await screen.findByRole("button", { name: "Enviando encargo" });
    fireEvent.change(screen.getByLabelText("Presentación"), { target: { value: SAUVAGE_100 } });
    await act(async () =>
      resolve({ status: "error", message: "Demasiados intentos.", values: { variantId: SAUVAGE_10 } }),
    );

    expect((screen.getByLabelText("Presentación") as HTMLSelectElement).value).toBe(SAUVAGE_100);
    mocks.createPerfumeRequest.mockResolvedValue({ status: "success", perfumeName: "Sauvage EDT" });
    submit();
    await waitFor(() => expect(mocks.createPerfumeRequest).toHaveBeenCalledTimes(2));
    expect(sentForm().get("variantId")).toBe(SAUVAGE_100);
    expect(sentForm().get("presentation")).toBe("Frasco 100 ml");
  });

  it("con un error en la presentación lo marca en el select y conserva la elegida", async () => {
    mocks.createPerfumeRequest.mockResolvedValue({
      status: "error",
      fieldErrors: { variantId: "Elegí una de las presentaciones." },
      values: { variantId: SAUVAGE_100 },
    });
    render(<PerfumeRequestForm prefill={sauvage} />);
    fireEvent.change(screen.getByLabelText("Presentación"), { target: { value: SAUVAGE_100 } });
    fillCustomer();
    submit();

    await screen.findByText("Elegí una de las presentaciones.");
    const select = screen.getByLabelText("Presentación") as HTMLSelectElement;
    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.value).toBe(SAUVAGE_100);
  });
});
