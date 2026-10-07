// @vitest-environment node
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: auth.getUser }, rpc: auth.rpc }),
}));

const { getAdminStatus, requireAdmin } = await import("./auth");
const { ADMIN_LOGIN_PATH } = await import("./paths");

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "admin@falber.test" };

afterEach(() => vi.clearAllMocks());

// Los errores son las clases reales de auth-js: así se prueba contra lo que devuelve getUser().
const getUserFails = (error: Error) => auth.getUser.mockResolvedValue({ data: { user: null }, error });
const noSession = () => getUserFails(new AuthSessionMissingError());
const session = (isAdmin: boolean) => {
  auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  auth.rpc.mockResolvedValue({ data: isAdmin, error: null });
};

// redirect() de Next lanza un error con el destino en `digest`: así corta la acción o el render.
const redirectTo = (path: string) => expect.objectContaining({ digest: expect.stringContaining(`;${path};`) });

describe("getAdminStatus", () => {
  it("sin sesión es 'anonymous' y no consulta is_admin", async () => {
    noSession();
    await expect(getAdminStatus()).resolves.toMatchObject({ status: "anonymous" });
    expect(auth.rpc).not.toHaveBeenCalled();
  });

  it("con sesión sin perfil de admin es 'forbidden'", async () => {
    session(false);
    await expect(getAdminStatus()).resolves.toMatchObject({ status: "forbidden", user: USER });
    expect(auth.rpc).toHaveBeenCalledWith("is_admin");
  });

  it("con perfil de admin es 'admin'", async () => {
    session(true);
    await expect(getAdminStatus()).resolves.toMatchObject({ status: "admin", user: USER });
  });

  it("si is_admin falla, lanza (error.tsx) en vez de tratarlo como 'sin acceso'", async () => {
    auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    auth.rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    await expect(getAdminStatus()).rejects.toThrow("is_admin");
  });

  // Auth respondió que la sesión no vale (revocada, usuario borrado): la cookie sigue ahí,
  // pero es "sin sesión". Si lanzara, el login también fallaría y no habría cómo volver a entrar.
  it("con la sesión revocada en Auth (4xx) es 'anonymous'", async () => {
    getUserFails(new AuthApiError("Session from session_id claim in JWT does not exist", 403, "session_not_found"));
    await expect(getAdminStatus()).resolves.toMatchObject({ status: "anonymous" });
    expect(auth.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["sin red", new AuthRetryableFetchError("fetch failed", 0)],
    ["con Auth caído (503)", new AuthRetryableFetchError("Service Unavailable", 503)],
  ])("%s lanza (error.tsx) en vez de mostrar el login", async (_case, error) => {
    getUserFails(error);
    await expect(getAdminStatus()).rejects.toThrow("No se pudo verificar la sesión");
    expect(auth.rpc).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  it("sin sesión redirige al login", async () => {
    noSession();
    await expect(requireAdmin()).rejects.toEqual(redirectTo(ADMIN_LOGIN_PATH));
  });

  it("sin perfil de admin también redirige al login (la página muestra 'sin acceso')", async () => {
    session(false);
    await expect(requireAdmin()).rejects.toEqual(redirectTo(ADMIN_LOGIN_PATH));
  });

  it("un admin recibe el cliente con su sesión y el usuario", async () => {
    session(true);
    const result = await requireAdmin();
    expect(result.user).toEqual(USER);
    expect(result.supabase.rpc).toBe(auth.rpc);
  });
});
