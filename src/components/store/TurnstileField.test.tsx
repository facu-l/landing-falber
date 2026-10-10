import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { TURNSTILE_FIELD } from "@/lib/forms/form-data";
import { TurnstileField } from "./TurnstileField";

// Sin el script de Cloudflare: el widget entrega un token por cada resetKey.
vi.mock("./Turnstile", () => ({
  Turnstile: ({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) => {
    useEffect(() => onToken(`token-${resetKey}`), [onToken, resetKey]);
    return null;
  },
}));

const tokenInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${TURNSTILE_FIELD}"]`);

describe("TurnstileField", () => {
  it("manda el token del widget en su propio input oculto", () => {
    const { container } = render(<TurnstileField action="checkout" resetKey={0} />);
    expect(tokenInput(container)?.value).toBe("token-0");
  });

  it("con un resetKey nuevo manda el token nuevo", () => {
    const { container, rerender } = render(<TurnstileField action="checkout" resetKey={0} />);
    rerender(<TurnstileField action="checkout" resetKey={1} />);
    expect(tokenInput(container)?.value).toBe("token-1");
  });
});
