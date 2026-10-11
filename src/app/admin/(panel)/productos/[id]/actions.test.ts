// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_DATA_ERRORS, PRODUCT_DATA_NOT_SAVED, PRODUCT_DATA_SAVE_ERROR } from "@/lib/admin/product-data";
import { PHOTO_ERRORS } from "@/lib/admin/product-photo";

const mocks = vi.hoisted(() => ({
  requireAdminAction: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  // products: select(...).eq().maybeSingle() y update().eq().select()
  readProduct: vi.fn(),
  update: vi.fn(),
  updateResult: vi.fn(),
  // storage.from("product-images")
  createSignedUploadUrl: vi.fn(),
  exists: vi.fn(),
  remove: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, refresh: mocks.refresh }));
vi.mock("@/lib/admin/auth", () => ({ requireAdminAction: mocks.requireAdminAction }));

const { requestPhotoUpload, savePhoto, updateProductData } = await import("./actions");

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const NEW_PATH = "dior-sauvage-0123456789ab.webp";
const OLD_PATH = "dior-sauvage-aaaaaaaaaaaa.webp";

function supabase() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.readProduct }) }),
      update: (values: unknown) => {
        mocks.update(values);
        return { eq: () => ({ select: mocks.updateResult }) };
      },
    }),
    storage: { from: mocks.storageFrom },
  };
}

beforeEach(() => {
  mocks.requireAdminAction.mockResolvedValue({ ok: true, supabase: supabase(), user: { id: "admin" } });
  mocks.readProduct.mockResolvedValue({ data: { slug: "dior-sauvage", image_path: OLD_PATH }, error: null });
  mocks.updateResult.mockResolvedValue({ data: [{ id: PRODUCT_ID }], error: null });
  mocks.storageFrom.mockReturnValue({
    createSignedUploadUrl: mocks.createSignedUploadUrl,
    exists: mocks.exists,
    remove: mocks.remove,
  });
  mocks.createSignedUploadUrl.mockImplementation(async (path: string) => ({
    data: { signedUrl: `http://storage/sign/${path}?token=t`, path, token: "t" },
    error: null,
  }));
  mocks.exists.mockResolvedValue({ data: true, error: null });
  mocks.remove.mockImplementation(async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("requestPhotoUpload", () => {
  it("sin admin no firma nada (requireAdminAction corta con un redirect)", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(requestPhotoUpload(PRODUCT_ID, "image/webp")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("firma una ruta del slug del producto, armada en el servidor", async () => {
    const result = await requestPhotoUpload(PRODUCT_ID, "image/jpeg");

    expect(mocks.storageFrom).toHaveBeenCalledWith("product-images");
    const [path] = mocks.createSignedUploadUrl.mock.calls[0];
    expect(path).toMatch(/^dior-sauvage-[0-9a-f]{12}\.jpg$/);
    expect(result).toEqual({ ok: true, signedUrl: `http://storage/sign/${path}?token=t`, path });
  });

  it("un tipo que el bucket no acepta no se firma", async () => {
    await expect(requestPhotoUpload(PRODUCT_ID, "image/png")).resolves.toEqual({
      ok: false,
      message: PHOTO_ERRORS.unreadable,
    });
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("un producto que no existe no se firma", async () => {
    mocks.readProduct.mockResolvedValue({ data: null, error: null });
    await expect(requestPhotoUpload(PRODUCT_ID, "image/webp")).resolves.toEqual({
      ok: false,
      message: PHOTO_ERRORS.notFound,
    });
  });

  it("si Storage no firma, avisa y lo loguea", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "new row violates policy" } });

    await expect(requestPhotoUpload(PRODUCT_ID, "image/webp")).resolves.toEqual({
      ok: false,
      message: PHOTO_ERRORS.upload,
    });
    expect(log).toHaveBeenCalled();
  });
});

describe("savePhoto", () => {
  it("sin admin no escribe nada", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("guarda la ruta, borra la anterior, vence el caché de la tienda y refresca", async () => {
    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: true });

    expect(mocks.exists).toHaveBeenCalledWith(NEW_PATH);
    expect(mocks.update).toHaveBeenCalledWith({ image_path: NEW_PATH });
    expect(mocks.remove).toHaveBeenCalledWith([OLD_PATH]);
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("sin foto anterior no borra nada", async () => {
    mocks.readProduct.mockResolvedValue({ data: { slug: "dior-sauvage", image_path: null }, error: null });
    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: true });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each([
    ["con otra forma", "dior-sauvage.webp"],
    ["de otro producto", "creed-aventus-0123456789ab.webp"],
    ["de un slug que empieza igual", "dior-sauvage-edt-0123456789ab.webp"],
  ])("rechaza una ruta %s sin tocar la base ni el bucket (D6)", async (_case, path) => {
    await expect(savePhoto(PRODUCT_ID, path)).resolves.toEqual({ ok: false, message: PHOTO_ERRORS.invalidPath });
    expect(mocks.exists).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rechaza una ruta que no está en el bucket (subida cortada o inventada)", async () => {
    mocks.exists.mockResolvedValue({ data: false, error: { message: "Object not found" } });

    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: false, message: PHOTO_ERRORS.invalidPath });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si la base no guarda, borra la foto nueva y conserva la anterior", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateResult.mockResolvedValue({ data: null, error: { code: "XX000", message: "fetch failed", details: "x" } });

    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: false, message: PHOTO_ERRORS.save });
    expect(mocks.remove).toHaveBeenCalledWith([NEW_PATH]);
    expect(mocks.remove).not.toHaveBeenCalledWith([OLD_PATH]);
    expect(log).toHaveBeenCalledWith("[admin] guardar la foto del producto falló", { code: "XX000", message: "fetch failed" });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("si no tocó ninguna fila (RLS), también borra la nueva", async () => {
    mocks.updateResult.mockResolvedValue({ data: [], error: null });

    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: false, message: PHOTO_ERRORS.save });
    expect(mocks.remove).toHaveBeenCalledWith([NEW_PATH]);
  });

  it("si borrar la anterior falla, la foto nueva igual queda guardada (solo se loguea)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.remove.mockResolvedValue({ data: null, error: { message: "timeout" } });

    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith("[admin] borrar la foto anterior falló", "timeout");
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
  });

  it("un borrado que no borra nada (RLS sin select, ver 0004) también se loguea", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.remove.mockResolvedValue({ data: [], error: null });

    await expect(savePhoto(PRODUCT_ID, NEW_PATH)).resolves.toEqual({ ok: true });
    expect(log).toHaveBeenCalledWith("[admin] borrar la foto anterior falló", "no se borró ningún objeto");
  });
});

describe("updateProductData", () => {
  const IDLE = { status: "idle" } as const;
  const VALUES = { brand: "Dior", name: "Sauvage EDT", gender: "male", description: "Fresco.", featured: "on" };

  function form(fields: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  it("sin admin no escribe nada", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(updateProductData(PRODUCT_ID, IDLE, form(VALUES))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("guarda los datos sin tocar el slug, vence el caché de la tienda y refresca", async () => {
    await expect(updateProductData(PRODUCT_ID, IDLE, form({ ...VALUES, slug: "otro" }))).resolves.toEqual({
      status: "success",
      message: "Datos guardados.",
    });
    expect(mocks.update).toHaveBeenCalledWith({
      brand: "Dior",
      name: "Sauvage EDT",
      gender: "male",
      description: "Fresco.",
      is_featured: true,
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("datos inválidos no llegan a la base y vuelven con lo escrito", async () => {
    await expect(updateProductData(PRODUCT_ID, IDLE, form({ ...VALUES, gender: "otro" }))).resolves.toEqual({
      status: "error",
      fieldErrors: { gender: PRODUCT_DATA_ERRORS.gender },
      values: { ...VALUES, gender: "otro" },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("si no tocó ninguna fila, avisa y no vence el caché", async () => {
    mocks.updateResult.mockResolvedValue({ data: [], error: null });
    await expect(updateProductData(PRODUCT_ID, IDLE, form(VALUES))).resolves.toMatchObject({
      status: "error",
      message: PRODUCT_DATA_NOT_SAVED,
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("un error de la base se loguea sin details, con mensaje genérico y lo escrito", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateResult.mockResolvedValue({ data: null, error: { code: "XX000", message: "fetch failed", details: "fila" } });

    await expect(updateProductData(PRODUCT_ID, IDLE, form(VALUES))).resolves.toEqual({
      status: "error",
      message: PRODUCT_DATA_SAVE_ERROR,
      values: VALUES,
    });
    expect(log).toHaveBeenCalledWith("[admin] guardar los datos del producto falló", { code: "XX000", message: "fetch failed" });
  });
});
