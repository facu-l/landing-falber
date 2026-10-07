import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TURNSTILE_FIELD } from "@/lib/forms/form-data";
import type { LoginState } from "@/lib/admin/login-state";

const mocks = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("@/app/admin/login/actions", () => ({ signIn: mocks.signIn }));
// Sin el script de Cloudflare: entrega un token distinto por cada resetKey.
vi.mock("@/components/store/Turnstile", () => ({
  Turnstile: ({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) => {
    useEffect(() => onToken(`token-${resetKey}`), [onToken, resetKey]);
    return null;
  },
}));

const { LoginForm } = await import("./LoginForm");

const field = (label: string) => screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

afterEach(() => vi.clearAllMocks());

describe("LoginForm", () => {
  it("manda email y contraseña a signIn", async () => {
    mocks.signIn.mockResolvedValue({ status: "idle" } satisfies LoginState);
    render(<LoginForm />);

    type("Email", "admin@falber.test");
    type("Contraseña", "clave");
    submit();

    await waitFor(() => expect(mocks.signIn).toHaveBeenCalled());
    const sent: FormData = mocks.signIn.mock.calls[0][1];
    expect(sent.get("email")).toBe("admin@falber.test");
    expect(sent.get("password")).toBe("clave");
    // El token va a Supabase Auth (CAPTCHA nativo), que es quien lo verifica.
    expect(sent.get(TURNSTILE_FIELD)).toBe("token-0");
  });

  it("después de un error del servidor pide un token nuevo: cada uno sirve una sola vez", async () => {
    mocks.signIn.mockResolvedValue({
      status: "error",
      message: "El email o la contraseña no coinciden.",
      values: { email: "admin@falber.test" },
    } satisfies LoginState);
    render(<LoginForm />);

    type("Email", "admin@falber.test");
    type("Contraseña", "mal");
    submit();
    await screen.findByRole("alert");
    type("Contraseña", "clave");
    submit();

    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(2));
    expect((mocks.signIn.mock.calls[1][1] as FormData).get(TURNSTILE_FIELD)).toBe("token-1");
  });

  it("la contraseña es un campo de contraseña con el autocompletado correcto", () => {
    render(<LoginForm />);
    expect(field("Contraseña").type).toBe("password");
    expect(field("Contraseña").autocomplete).toBe("current-password");
    expect(field("Email").autocomplete).toBe("username");
  });

  it("muestra el error del servidor y conserva el email escrito", async () => {
    mocks.signIn.mockResolvedValue({
      status: "error",
      message: "El email o la contraseña no coinciden.",
      values: { email: "admin@falber.test" },
    } satisfies LoginState);
    render(<LoginForm />);

    type("Email", "admin@falber.test");
    type("Contraseña", "mal");
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("El email o la contraseña no coinciden.");
    expect(field("Email").value).toBe("admin@falber.test");
  });

  it("muestra los errores por campo", async () => {
    mocks.signIn.mockResolvedValue({
      status: "error",
      fieldErrors: { email: "Escribí un email válido.", password: "Escribí tu contraseña." },
      values: { email: "admin" },
    } satisfies LoginState);
    render(<LoginForm />);

    submit();

    await waitFor(() => expect(field("Email").getAttribute("aria-invalid")).toBe("true"));
    screen.getByText("Escribí un email válido.");
    screen.getByText("Escribí tu contraseña.");
  });
});
