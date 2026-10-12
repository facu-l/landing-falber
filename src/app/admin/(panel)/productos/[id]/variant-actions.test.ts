// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INITIAL_VARIANT_FORM_STATE,
  VARIANT_ERRORS,
  VARIANT_NOT_SAVED,
  VARIANT_SAVE_ERROR,
  variantCreatedWithoutStock,
} from "@/lib/admin/product-variants";

const mocks = vi.hoisted(() => ({
  requireAdminAction: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
  // product_variants: select().eq(), insert().select().single(), update().eq().select()
  readVariants: vi.fn(),
  insertVariant: vi.fn(),
  insertVariantResult: vi.fn(),
  updateVariant: vi.fn(),
  updateVariantResult: vi.fn(),
  // stock_movements: insert()
  insertMovement: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag, refresh: mocks.refresh }));
vi.mock("@/lib/admin/auth", () => ({ requireAdminAction: mocks.requireAdminAction }));

const { addVariant, updateVariant } = await import("./variant-actions");

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const VARIANT_ID = "22222222-2222-2222-2222-222222222222";

function supabase() {
  return {
    from: (table: string) => {
      if (table === "stock_movements") return { insert: mocks.insertMovement };
      return {
        select: () => ({ eq: mocks.readVariants }),
        insert: (row: unknown) => {
          mocks.insertVariant(row);
          return { select: () => ({ single: mocks.insertVariantResult }) };
        },
        update: (values: unknown) => {
          mocks.updateVariant(values);
          return { eq: () => ({ select: mocks.updateVariantResult }) };
        },
      };
    },
  };
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const NEW_DECANT = { variantType: "decant", sizeMl: "5", price: "12.000", initialStock: "4" };

beforeEach(() => {
  mocks.requireAdminAction.mockResolvedValue({ ok: true, supabase: supabase(), user: { id: "admin" } });
  mocks.readVariants.mockResolvedValue({ data: [{ variant_type: "decant", size_ml: 3 }], error: null });
  mocks.insertVariantResult.mockResolvedValue({ data: { id: VARIANT_ID, label: "Decant 5 ml" }, error: null });
  mocks.insertMovement.mockResolvedValue({ error: null });
  mocks.updateVariantResult.mockResolvedValue({ data: [{ id: VARIANT_ID }], error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("addVariant", () => {
  const add = (values: Record<string, string>) => addVariant(PRODUCT_ID, INITIAL_VARIANT_FORM_STATE, form(values));

  it("sin admin no escribe nada (requireAdminAction corta con un redirect)", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(add(NEW_DECANT)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.insertVariant).not.toHaveBeenCalled();
  });

  it("si no se pudo verificar el acceso, avisa y devuelve lo escrito", async () => {
    mocks.requireAdminAction.mockResolvedValue({ ok: false, message: "Sin acceso" });
    expect(await add(NEW_DECANT)).toEqual({ status: "error", message: "Sin acceso", values: NEW_DECANT });
    expect(mocks.insertVariant).not.toHaveBeenCalled();
  });

  it("crea la presentación disponible y carga el stock inicial como initial_stock", async () => {
    expect(await add(NEW_DECANT)).toEqual({ status: "success", message: "Se agregó Decant 5 ml." });
    expect(mocks.insertVariant).toHaveBeenCalledWith({
      product_id: PRODUCT_ID,
      variant_type: "decant",
      size_ml: 5,
      price: 12000,
      is_available: true,
    });
    expect(mocks.insertMovement).toHaveBeenCalledWith({
      variant_id: VARIANT_ID,
      movement_type: "initial_stock",
      quantity: 4,
      note: null,
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("sin stock inicial no inserta ningún movimiento (la base rechaza quantity 0)", async () => {
    expect(await add({ ...NEW_DECANT, initialStock: "" })).toMatchObject({ status: "success" });
    expect(mocks.insertMovement).not.toHaveBeenCalled();
  });

  it("valida contra las presentaciones que lee de la base, no contra el navegador", async () => {
    mocks.readVariants.mockResolvedValue({ data: [{ variant_type: "decant", size_ml: 5 }], error: null });
    expect(await add(NEW_DECANT)).toEqual({
      status: "error",
      fieldErrors: { sizeMl: VARIANT_ERRORS.duplicate },
      values: NEW_DECANT,
    });
    expect(mocks.readVariants).toHaveBeenCalledWith("product_id", PRODUCT_ID);
    expect(mocks.insertVariant).not.toHaveBeenCalled();
  });

  it("devuelve los errores de los campos sin escribir", async () => {
    const result = await add({ ...NEW_DECANT, price: "" });
    expect(result).toMatchObject({ status: "error", fieldErrors: { price: VARIANT_ERRORS.priceRequired } });
    expect(mocks.insertVariant).not.toHaveBeenCalled();
  });

  it("si leer las presentaciones falla, no escribe y pide reintentar", async () => {
    mocks.readVariants.mockResolvedValue({ data: null, error: { code: "08006", message: "connection" } });
    expect(await add(NEW_DECANT)).toEqual({ status: "error", message: VARIANT_SAVE_ERROR, values: NEW_DECANT });
    expect(mocks.insertVariant).not.toHaveBeenCalled();
  });

  it("si otra pestaña la creó antes, el unique de la base se marca en el tamaño", async () => {
    mocks.insertVariantResult.mockResolvedValue({
      data: null,
      error: { code: "23505", message: 'violates unique constraint "product_variants_product_id_variant_type_size_ml_key"' },
    });
    expect(await add(NEW_DECANT)).toEqual({
      status: "error",
      fieldErrors: { sizeMl: VARIANT_ERRORS.duplicate },
      values: NEW_DECANT,
    });
    expect(mocks.insertMovement).not.toHaveBeenCalled();
  });

  it("otro error de la base se loguea sin details y pide reintentar", async () => {
    mocks.insertVariantResult.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied", details: "Failing row contains (...)" },
    });
    expect(await add(NEW_DECANT)).toEqual({ status: "error", message: VARIANT_SAVE_ERROR, values: NEW_DECANT });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), { code: "42501", message: "permission denied" });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("si el stock inicial falla, avisa el fallo parcial y refresca (la presentación ya está)", async () => {
    mocks.insertMovement.mockResolvedValue({ error: { code: "08006", message: "connection" } });
    expect(await add(NEW_DECANT)).toEqual({ status: "partial", message: variantCreatedWithoutStock("Decant 5 ml") });
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
    expect(mocks.refresh).toHaveBeenCalled();
  });
});

describe("updateVariant", () => {
  const edit = (values: Record<string, string>) => updateVariant(VARIANT_ID, INITIAL_VARIANT_FORM_STATE, form(values));

  it("sin admin no escribe nada", async () => {
    mocks.requireAdminAction.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(edit({ price: "15.000", isAvailable: "on" })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });

  it("guarda solo precio y Disponible", async () => {
    expect(await edit({ price: "15.000" })).toEqual({ status: "success", message: "Presentación guardada." });
    expect(mocks.updateVariant).toHaveBeenCalledWith({ price: 15000, is_available: false });
    expect(mocks.updateTag).toHaveBeenCalledWith("catalog");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("devuelve el error del precio sin escribir", async () => {
    const values = { price: "0", isAvailable: "on" };
    expect(await edit(values)).toEqual({ status: "error", fieldErrors: { price: VARIANT_ERRORS.priceZero }, values });
    expect(mocks.updateVariant).not.toHaveBeenCalled();
  });

  it("un error de la base pide reintentar", async () => {
    mocks.updateVariantResult.mockResolvedValue({ data: null, error: { code: "08006", message: "connection" } });
    const values = { price: "15.000", isAvailable: "on" };
    expect(await edit(values)).toEqual({ status: "error", message: VARIANT_SAVE_ERROR, values });
  });

  it("0 filas (RLS o id inexistente) no se da por guardado", async () => {
    mocks.updateVariantResult.mockResolvedValue({ data: [], error: null });
    const values = { price: "15.000", isAvailable: "on" };
    expect(await edit(values)).toEqual({ status: "error", message: VARIANT_NOT_SAVED, values });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
