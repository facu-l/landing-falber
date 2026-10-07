// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GENERIC_LOGIN_ERROR, LOGIN_ERRORS } from "@/lib/admin/login";
import { ADMIN_LOGIN_PATH, ADMIN_ORDERS_PATH } from "@/lib/admin/paths";

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

const { signIn, signOut } = await import("./actions");

const PASSWORD = "clave-de-prueba";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// redirect() de Next lanza un error con el destino en `digest`.
const redirectTo = (path: string) => expect.objectContaining({ digest: expect.stringContaining(`;${path};`) });

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("signIn", () => {
  it("con email y contraseña correctos inicia sesión y va a los pedidos", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    await expect(
      signIn({ status: "idle" }, form({ email: " Admin@Falber.test", password: PASSWORD })),
    ).rejects.toEqual(redirectTo(ADMIN_ORDERS_PATH));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "admin@falber.test", password: PASSWORD });
  });

  it("un formulario incompleto no llama a Supabase y devuelve los errores por campo", async () => {
    await expect(signIn({ status: "idle" }, form({ email: "admin", password: "" }))).resolves.toEqual({
      status: "error",
      fieldErrors: { email: "Escribí un email válido.", password: "Escribí tu contraseña." },
      values: { email: "admin" },
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("credenciales incorrectas: un mensaje que no dice cuál de los dos falló", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", message: "x" } });

    await expect(
      signIn({ status: "idle" }, form({ email: "admin@falber.test", password: PASSWORD })),
    ).resolves.toEqual({
      status: "error",
      message: LOGIN_ERRORS.invalid_credentials,
      values: { email: "admin@falber.test" },
    });
  });

  it("demasiados intentos: lo dice", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "over_request_rate_limit", message: "x" } });

    const state = await signIn({ status: "idle" }, form({ email: "admin@falber.test", password: PASSWORD }));
    expect(state).toMatchObject({ status: "error", message: LOGIN_ERRORS.over_request_rate_limit });
  });

  it("un error desconocido se loguea y muestra un mensaje genérico", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = { code: "unexpected_failure", message: "fetch failed" };
    auth.signInWithPassword.mockResolvedValue({ data: {}, error });

    const state = await signIn({ status: "idle" }, form({ email: "admin@falber.test", password: PASSWORD }));

    expect(state).toMatchObject({ status: "error", message: GENERIC_LOGIN_ERROR });
    expect(log).toHaveBeenCalledWith("[admin] signInWithPassword falló", error);
  });

  it("la contraseña nunca vuelve en el estado", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", message: "x" } });

    const state = await signIn({ status: "idle" }, form({ email: "admin@falber.test", password: PASSWORD }));
    expect(JSON.stringify(state)).not.toContain(PASSWORD);
  });
});

describe("signOut", () => {
  it("cierra la sesión y vuelve al login", async () => {
    auth.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toEqual(redirectTo(ADMIN_LOGIN_PATH));
    // Solo esta sesión: sin scope, supabase-js usa "global" y cierra también la del celular.
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
