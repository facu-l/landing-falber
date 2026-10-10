import { render } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Turnstile } from "./Turnstile";

// Sin el script de Cloudflare: window.turnstile ya está "cargado".
vi.mock("next/script", () => ({ default: () => null }));

const api = { render: vi.fn(() => "widget-1"), reset: vi.fn(), remove: vi.fn() };
const onToken = () => {};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000BB");
  window.turnstile = api;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  delete window.turnstile;
});

describe("Turnstile", () => {
  it("manda la acción del formulario al widget (el servidor exige la misma)", () => {
    render(<Turnstile action="encargo" onToken={onToken} resetKey={0} />);
    expect(api.render).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "encargo" }));
  });

  it("un resetKey nuevo resetea el widget (el token anterior ya se usó)", () => {
    const { rerender } = render(<Turnstile action="checkout" onToken={onToken} resetKey={0} />);
    rerender(<Turnstile action="checkout" onToken={onToken} resetKey={1} />);
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it("un widget recién montado no se resetea aunque el resetKey sea mayor a 0", () => {
    render(<Turnstile action="checkout" onToken={onToken} resetKey={2} />);
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(api.reset).not.toHaveBeenCalled();
  });

  it("si Next esconde y vuelve a mostrar la página (Activity), no pide otro challenge", () => {
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <Turnstile action="checkout" onToken={onToken} resetKey={1} />
      </Activity>
    );
    const { rerender } = render(tree("visible"));
    rerender(tree("hidden"));
    rerender(tree("visible"));

    expect(api.reset).not.toHaveBeenCalled();
  });
});
