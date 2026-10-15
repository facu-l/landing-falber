import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HIDE_WARNING, PUBLISH_ERRORS, type PublishState } from "@/lib/admin/product-publish";

const mocks = vi.hoisted(() => ({ updateProductStatus: vi.fn() }));
vi.mock("@/app/admin/(panel)/productos/[id]/actions", () => ({ updateProductStatus: mocks.updateProductStatus }));

const { ProductPublishControl } = await import("./ProductPublishControl");

const DRAFT = { id: "p1", slug: "dior-sauvage-edt", status: "inactive" as const };
const LIVE = { ...DRAFT, status: "active" as const };

/** Lo que mandó la acción: el campo status del formulario (con bind: id, estado previo, FormData). */
const sentStatus = () => (mocks.updateProductStatus.mock.calls[0][2] as FormData).get("status");

afterEach(() => vi.clearAllMocks());

describe("ProductPublishControl", () => {
  it("sin publicar: Publicar es primario y se conecta con la lista de lo que falta", () => {
    render(<ProductPublishControl product={DRAFT} missing="Para publicar falta: foto" missingId="producto-faltantes" />);
    const publish = screen.getByRole("button", { name: "Publicar" });
    expect(publish.getAttribute("aria-describedby")).toBe("producto-faltantes");
    expect(screen.queryByRole("link", { name: /Ver en la tienda/ })).toBeNull();
  });

  it("publicar manda active; al salir bien lo dice", async () => {
    mocks.updateProductStatus.mockResolvedValue({ status: "success", published: true, message: "Publicado." } satisfies PublishState);
    render(<ProductPublishControl product={DRAFT} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    expect((await screen.findByRole("status")).textContent).toBe("Publicado.");
    expect(sentStatus()).toBe("active");
  });

  it("si la base dice que falta algo, lo muestra como alerta", async () => {
    mocks.updateProductStatus.mockResolvedValue({ status: "error", message: PUBLISH_ERRORS.image } satisfies PublishState);
    render(<ProductPublishControl product={DRAFT} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(PUBLISH_ERRORS.image);
  });

  it("cuando cambia lo que falta (se cargó la foto o una presentación), el error viejo se va", async () => {
    mocks.updateProductStatus.mockResolvedValue({ status: "error", message: PUBLISH_ERRORS.variant } satisfies PublishState);
    const missing = "Para publicar falta: una presentación disponible";
    const { rerender } = render(<ProductPublishControl product={DRAFT} missing={missing} missingId="faltan" />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await screen.findByRole("alert");

    rerender(<ProductPublishControl product={DRAFT} missing={missing} missingId="faltan" />);
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(<ProductPublishControl product={DRAFT} missing={null} missingId="faltan" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Publicar" }).getAttribute("aria-describedby")).toBeNull();
  });

  it("publicado: link a la tienda en otra pestaña y Ocultar como secundario", () => {
    render(<ProductPublishControl product={LIVE} />);
    const link = screen.getByRole("link", { name: /Ver en la tienda/ });
    expect(link.getAttribute("href")).toBe("/producto/dior-sauvage-edt");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
  });

  it("ocultar pide confirmación: el primer click no envía nada", () => {
    render(<ProductPublishControl product={LIVE} />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));

    expect(screen.getByText(HIDE_WARNING)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sí, ocultar" })).toBeTruthy();
    expect(mocks.updateProductStatus).not.toHaveBeenCalled();
  });

  it("Cancelar vuelve atrás sin enviar", () => {
    render(<ProductPublishControl product={LIVE} />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText(HIDE_WARNING)).toBeNull();
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeTruthy();
    expect(mocks.updateProductStatus).not.toHaveBeenCalled();
  });

  it("confirmar manda inactive y avisa", async () => {
    mocks.updateProductStatus.mockResolvedValue({
      status: "success",
      published: false,
      message: "Oculto. Ya no aparece en la tienda.",
    } satisfies PublishState);
    render(<ProductPublishControl product={LIVE} />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, ocultar" }));

    expect((await screen.findByRole("status")).textContent).toBe("Oculto. Ya no aparece en la tienda.");
    expect(sentStatus()).toBe("inactive");
  });
});
