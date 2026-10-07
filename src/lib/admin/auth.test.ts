// @vitest-environment node
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

const noSession = () =>
  auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing" } });
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
