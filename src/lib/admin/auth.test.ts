// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: auth.getUser }, rpc: auth.rpc }),
}));

const { requireAdmin } = await import("./auth");
const { ADMIN_LOGIN_PATH, FORBIDDEN_LOGIN_PATH } = await import("./paths");

const USER = { id: "11111111-1111-1111-1111-111111111111", email: "admin@falber.test" };

afterEach(() => vi.clearAllMocks());

// redirect() de Next lanza un error con el destino en `digest`: así corta la acción o el render.
const redirectTo = (path: string) => expect.objectContaining({ digest: expect.stringContaining(`;${path};`) });

describe("requireAdmin", () => {
  it("sin sesión redirige al login", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing" } });

    await expect(requireAdmin()).rejects.toEqual(redirectTo(ADMIN_LOGIN_PATH));
    expect(auth.rpc).not.toHaveBeenCalled();
  });

  it("con sesión pero sin perfil de admin redirige al login con el motivo (no al panel: sería un bucle)", async () => {
    auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    auth.rpc.mockResolvedValue({ data: false, error: null });

    await expect(requireAdmin()).rejects.toEqual(redirectTo(FORBIDDEN_LOGIN_PATH));
    expect(auth.rpc).toHaveBeenCalledWith("is_admin");
  });

  it("un admin recibe el cliente con su sesión y el usuario", async () => {
    auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    auth.rpc.mockResolvedValue({ data: true, error: null });

    const result = await requireAdmin();

    expect(result.user).toEqual(USER);
    expect(result.supabase.rpc).toBe(auth.rpc);
  });

  it("si is_admin falla, lanza (error.tsx) en vez de tratarlo como 'sin acceso'", async () => {
    auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    auth.rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });

    await expect(requireAdmin()).rejects.toThrow("is_admin");
  });
});
