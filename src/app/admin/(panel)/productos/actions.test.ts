// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NEW_PRODUCT_ERRORS, NEW_PRODUCT_SAVE_ERROR } from "@/lib/admin/product-list";

const mocks = vi.hoisted(() => ({
  requireAdminAction: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin/auth", () => ({ requireAdminAction: mocks.requireAdminAction }));

const { createProduct } = await import("./actions");

const ACCESS_FAILED = { ok: false, message: "No pudimos verificar tu acceso." } as const;
const IDLE = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** insert().select().single() de supabase-js, con la respuesta que da la base. */
function databaseAnswers(result: { data: unknown; error: unknown }) {
  mocks.single.mockResolvedValue(result);
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.insert.mockReturnValue({ select: mocks.select });
  mocks.from.mockReturnValue({ insert: mocks.insert });
}

beforeEach(() => {
  mocks.requireAdminAction.mockResolvedValue({ ok: true, supabase: { from: mocks.from }, user: { id: "admin" } });
  databaseAnswers({ data: { id: "nuevo-id" }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("createProduct", () => {
  it("sin admin no escribe nada (requireAdminAction corta con un redirect)", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(createProduct(IDLE, form({ brand: "Dior", name: "Sauvage" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("si no se pudo verificar el acceso, vuelve al formulario con lo escrito", async () => {
    mocks.requireAdminAction.mockResolvedValue(ACCESS_FAILED);

    await expect(createProduct(IDLE, form({ brand: "Dior", name: "Sauvage" }))).resolves.toEqual({
      status: "error",
      message: ACCESS_FAILED.message,
      values: { brand: "Dior", name: "Sauvage" },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("crea con el slug del servidor, sin status (lo pone la base), y va a la ficha", async () => {
    // Un slug mandado desde el navegador se ignora: lo arma el servidor.
    await expect(
      createProduct(IDLE, form({ brand: " Dior ", name: "Sauvage EDT", slug: "otro-slug", status: "active" })),
    ).rejects.toThrow("NEXT_REDIRECT /admin/productos/nuevo-id?nuevo=1");

    expect(mocks.from).toHaveBeenCalledWith("products");
    expect(mocks.insert).toHaveBeenCalledWith({ brand: "Dior", name: "Sauvage EDT", slug: "dior-sauvage-edt" });
    expect(mocks.select).toHaveBeenCalledWith("id");
  });

  it("datos inválidos no llegan a la base y vuelven con lo escrito", async () => {
    await expect(createProduct(IDLE, form({ brand: "", name: "Sauvage" }))).resolves.toEqual({
      status: "error",
      fieldErrors: { brand: NEW_PRODUCT_ERRORS.brandRequired },
      values: { brand: "", name: "Sauvage" },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("un slug repetido se marca en el nombre, sin loguear", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseAnswers({
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "products_slug_key"' },
    });

    await expect(createProduct(IDLE, form({ brand: "Dior", name: "Sauvage" }))).resolves.toEqual({
      status: "error",
      fieldErrors: { name: NEW_PRODUCT_ERRORS.duplicateSlug },
      values: { brand: "Dior", name: "Sauvage" },
    });
    expect(log).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("otro error de la base se loguea sin details, con mensaje genérico y lo escrito", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    databaseAnswers({ data: null, error: { code: "42501", message: "permission denied", details: "fila" } });

    await expect(createProduct(IDLE, form({ brand: "Dior", name: "Sauvage" }))).resolves.toEqual({
      status: "error",
      message: NEW_PRODUCT_SAVE_ERROR,
      values: { brand: "Dior", name: "Sauvage" },
    });
    expect(log).toHaveBeenCalledWith("[admin] crear un producto falló", { code: "42501", message: "permission denied" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
