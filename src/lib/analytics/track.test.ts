// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./track";

afterEach(() => {
  delete window.gtag;
});

describe("trackEvent", () => {
  it("no hace nada si gtag todavía no cargó", () => {
    expect(() => trackEvent("whatsapp_click", { source: "checkout" })).not.toThrow();
  });

  it("llama a gtag con el evento y los parámetros", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent("whatsapp_click", { source: "encargo" });
    expect(gtag).toHaveBeenCalledWith("event", "whatsapp_click", { source: "encargo" });
  });
});
