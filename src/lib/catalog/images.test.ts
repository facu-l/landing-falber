// @vitest-environment node
import { describe, expect, it } from "vitest";
import { productImageSrc } from "./images";

describe("productImageSrc", () => {
  it("sin foto devuelve null", () => {
    expect(productImageSrc(null, {})).toBeNull();
  });

  it("sin la URL de Supabase devuelve null (la tienda muestra el recuadro sin foto)", () => {
    expect(productImageSrc("dior-sauvage-edt.webp", {})).toBeNull();
  });

  it("arma la URL pública del bucket de Supabase", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" };
    expect(productImageSrc("perfumes/oud wood.webp", env)).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-images/perfumes/oud%20wood.webp",
    );
  });
});
