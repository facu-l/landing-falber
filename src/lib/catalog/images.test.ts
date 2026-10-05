// @vitest-environment node
import { describe, expect, it } from "vitest";
import { productImageSrc } from "./images";

describe("productImageSrc", () => {
  it("sin foto devuelve null", () => {
    expect(productImageSrc(null, {})).toBeNull();
  });

  it("con base explícita usa las fotos de public/ (local y CI)", () => {
    const env = { NEXT_PUBLIC_PRODUCT_IMAGES_BASE_URL: "/product-images/" };
    expect(productImageSrc("dior-sauvage-edt.webp", env)).toBe("/product-images/dior-sauvage-edt.webp");
  });

  it("sin base arma la URL pública del bucket de Supabase", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" };
    expect(productImageSrc("perfumes/oud wood.webp", env)).toBe(
      "https://abc.supabase.co/storage/v1/object/public/product-images/perfumes/oud%20wood.webp",
    );
  });
});
