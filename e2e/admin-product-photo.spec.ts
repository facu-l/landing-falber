import { expect, type Page, test } from "@playwright/test";
import path from "node:path";
import { localAdminClient } from "../scripts/local-users";
import { createTestUser, createUnpublishedProduct, signInAdmin } from "./admin-helpers";

/*
 * Foto de un producto de punta a punta, contra el Storage local: el navegador achica la
 * foto, la sube a la URL firmada y la acción guarda la ruta (decisiones 96 y 97, D6, D15).
 *
 * El fixture está guardado apaisado (300×200) con EXIF de orientación 6 ("rotá 90°"):
 * si la subida respeta el EXIF, la foto del bucket queda vertical (200×300).
 */
const EXIF_PHOTO = path.join(__dirname, "fixtures", "photo-exif-orientation-6.jpg");
// PNG de 40×50 transparente con un cuadrado opaco al centro.
const TRANSPARENT_PHOTO = path.join(__dirname, "fixtures", "photo-transparent.png");

async function imagePathOf(productId: string) {
  const { data, error } = await localAdminClient().from("products").select("image_path").eq("id", productId).single();
  if (error) throw error;
  return data.image_path;
}

/** Tamaño real de la foto guardada en el bucket, decodificada por el navegador. */
async function storedSize(page: Page, imagePath: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${imagePath}`;
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, url);
}

test("un admin sube la foto: queda derecha, se ve en la ficha y reemplazarla borra la anterior", async ({ page }) => {
  const [admin, product] = await Promise.all([createTestUser({ admin: true }), createUnpublishedProduct()]);
  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");
  await page.goto(`/admin/productos/${product.id}`);

  const photo = page.getByRole("region", { name: "Foto" });
  await expect(photo.getByText("Sin foto.")).toBeVisible();
  await photo.getByLabel("Elegir foto").setInputFiles(EXIF_PHOTO);
  await expect(photo.getByRole("status")).toHaveText("Foto guardada.", { timeout: 15_000 });

  // La ruta la armó el servidor, con el slug del producto.
  const first = await imagePathOf(product.id);
  expect(first).toMatch(new RegExp(`^${product.slug}-[0-9a-f]{12}\\.(webp|jpg)$`));
  // Vertical: se aplicó la orientación EXIF antes de subir.
  expect(await storedSize(page, first!)).toEqual({ width: 200, height: 300 });
  // La ficha muestra la foto del bucket (vista Noir, como en la tienda).
  await expect(photo.locator('[data-theme="dark"] img')).toHaveAttribute("alt", product.title);
  await expect(photo.getByText("Cambiar foto")).toBeVisible();

  // Reemplazarla: ruta nueva y la anterior ya no está en el bucket.
  await photo.getByLabel("Cambiar foto").setInputFiles(EXIF_PHOTO);
  await expect(photo.getByRole("status")).toHaveText("Foto guardada.", { timeout: 15_000 });
  const second = await imagePathOf(product.id);
  expect(second).not.toBe(first);
  const { data: stillThere } = await localAdminClient().storage.from("product-images").exists(first!);
  expect(stillThere).toBe(false);
});

test("un archivo que no es una foto se rechaza sin tocar el producto", async ({ page }) => {
  const [admin, product] = await Promise.all([createTestUser({ admin: true }), createUnpublishedProduct()]);
  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");
  await page.goto(`/admin/productos/${product.id}`);

  const photo = page.getByRole("region", { name: "Foto" });
  await photo.getByLabel("Elegir foto").setInputFiles({
    name: "no-es-foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("esto no es una imagen"),
  });
  await expect(photo.getByRole("alert")).toHaveText("No se pudo leer la foto. Probá con otra o sacala de nuevo.");
  expect(await imagePathOf(product.id)).toBeNull();
});

test("un PNG transparente sale con el fondo de la foto en la tienda, no transparente ni negro", async ({ page }) => {
  const [admin, product] = await Promise.all([createTestUser({ admin: true }), createUnpublishedProduct()]);
  await signInAdmin(page, admin);
  await expect(page).toHaveURL("/admin/pedidos");
  await page.goto(`/admin/productos/${product.id}`);

  const photo = page.getByRole("region", { name: "Foto" });
  await photo.getByLabel("Elegir foto").setInputFiles(TRANSPARENT_PHOTO);
  await expect(photo.getByRole("status")).toHaveText("Foto guardada.", { timeout: 15_000 });

  // La esquina era transparente: tiene que ser surface-raised de Noir (#202226), opaco.
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${await imagePathOf(product.id)}`;
  const corner = await page.evaluate(async (src) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return [...context.getImageData(1, 1, 1, 1).data];
  }, url);
  const [r, g, b, a] = corner;
  expect(a).toBe(255);
  for (const [actual, expected] of [[r, 0x20], [g, 0x22], [b, 0x26]]) expect(Math.abs(actual - expected)).toBeLessThanOrEqual(6);
});
