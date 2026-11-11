import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppButton } from "./WhatsAppButton";

afterEach(() => {
  delete window.gtag;
});

describe("WhatsAppButton", () => {
  it("es un link que abre en una pestaña nueva hacia wa.me", () => {
    render(<WhatsAppButton href="https://wa.me/5492215551234" label="Enviar por WhatsApp" source="encargo" />);
    const link = screen.getByRole("link", { name: "Enviar por WhatsApp" });
    expect(link.getAttribute("href")).toBe("https://wa.me/5492215551234");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("dispara whatsapp_click con el source al hacer click", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    render(<WhatsAppButton href="https://wa.me/5492215551234" label="Completar pedido en WhatsApp" source="checkout" />);

    fireEvent.click(screen.getByRole("link", { name: "Completar pedido en WhatsApp" }));

    expect(gtag).toHaveBeenCalledWith("event", "whatsapp_click", { source: "checkout" });
  });
});
