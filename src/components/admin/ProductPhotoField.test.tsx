import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHOTO_ERRORS } from "@/lib/admin/product-photo";

const mocks = vi.hoisted(() => ({
  requestPhotoUpload: vi.fn(),
  savePhoto: vi.fn(),
  preparePhoto: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock("@/app/admin/(panel)/productos/[id]/actions", () => ({
  requestPhotoUpload: mocks.requestPhotoUpload,
  savePhoto: mocks.savePhoto,
}));
// createImageBitmap y canvas no existen en jsdom: eso lo prueba el E2E con el fixture EXIF.
vi.mock("@/lib/admin/photo-image", () => ({
  preparePhoto: mocks.preparePhoto,
  uploadToSignedUrl: mocks.uploadToSignedUrl,
}));

const { ProductPhotoField } = await import("./ProductPhotoField");

const blob = new Blob(["x"], { type: "image/webp" });
const file = new File(["foto"], "foto.jpg", { type: "image/jpeg" });

function choose() {
  fireEvent.change(screen.getByLabelText(/foto$/i), { target: { files: [file] } });
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:local");
  URL.revokeObjectURL = vi.fn();
  mocks.preparePhoto.mockResolvedValue({ ok: true, blob });
  mocks.requestPhotoUpload.mockResolvedValue({ ok: true, signedUrl: "http://storage/sign", path: "p-0123456789ab.webp" });
  mocks.uploadToSignedUrl.mockResolvedValue(true);
  mocks.savePhoto.mockResolvedValue({ ok: true });
});

afterEach(() => vi.clearAllMocks());

describe("ProductPhotoField", () => {
  it("sin foto ofrece Elegir foto; con foto, Cambiar foto", () => {
    const { unmount } = render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    expect(screen.getByText("Elegir foto")).toBeTruthy();
    expect(screen.getByText("Sin foto.")).toBeTruthy();
    unmount();

    render(<ProductPhotoField productId="p" imagePath="p.webp" alt="Dior · Sauvage" />);
    expect(screen.getByText("Cambiar foto")).toBeTruthy();
  });

  it("acepta cualquier imagen (el celular ofrece la cámara) y la vista previa es Noir", () => {
    const { container } = render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    const input = screen.getByLabelText("Elegir foto") as HTMLInputElement;
    expect(input.accept).toBe("image/*");
    expect(input.hasAttribute("capture")).toBe(false);
    expect(container.querySelector('[data-theme="dark"]')).not.toBeNull();
  });

  it("prepara, pide la URL con el tipo final, sube y guarda la ruta firmada", async () => {
    const { container } = render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    // El fondo sale del token de Noir del contenedor de la vista previa.
    container.querySelector<HTMLElement>('[data-theme="dark"]')!.style.setProperty("--surface-raised", "#202226");
    choose();

    expect(await screen.findByText("Foto guardada.")).toBeTruthy();
    expect(mocks.preparePhoto).toHaveBeenCalledWith(file, "#202226");
    expect(mocks.requestPhotoUpload).toHaveBeenCalledWith("p", "image/webp");
    expect(mocks.uploadToSignedUrl).toHaveBeenCalledWith("http://storage/sign", blob);
    expect(mocks.savePhoto).toHaveBeenCalledWith("p", "p-0123456789ab.webp");
  });

  it("una foto ilegible muestra el error, sin Reintentar (hay que elegir otra)", async () => {
    mocks.preparePhoto.mockResolvedValue({ ok: false, message: PHOTO_ERRORS.unreadable });
    render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    choose();

    expect((await screen.findByRole("alert")).textContent).toBe(PHOTO_ERRORS.unreadable);
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(mocks.requestPhotoUpload).not.toHaveBeenCalled();
  });

  it("si la subida falla, Reintentar usa la misma foto preparada (sin volver a elegirla)", async () => {
    mocks.uploadToSignedUrl.mockResolvedValueOnce(false);
    render(<ProductPhotoField productId="p" imagePath="vieja.webp" alt="Dior · Sauvage" />);
    choose();

    expect((await screen.findByRole("alert")).textContent).toBe(PHOTO_ERRORS.upload);
    expect(mocks.savePhoto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Foto guardada.")).toBeTruthy();
    expect(mocks.preparePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.uploadToSignedUrl).toHaveBeenLastCalledWith("http://storage/sign", blob);
  });

  it("si no se puede pedir la URL, muestra el mensaje del servidor, no sube y deja reintentar", async () => {
    mocks.requestPhotoUpload.mockResolvedValueOnce({ ok: false, message: PHOTO_ERRORS.notFound });
    render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    choose();

    expect((await screen.findByRole("alert")).textContent).toBe(PHOTO_ERRORS.notFound);
    expect(mocks.uploadToSignedUrl).not.toHaveBeenCalled();
    expect(mocks.savePhoto).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("si guardar falla, muestra el mensaje del servidor y deja reintentar", async () => {
    mocks.savePhoto.mockResolvedValueOnce({ ok: false, message: PHOTO_ERRORS.save });
    render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    choose();

    expect((await screen.findByRole("alert")).textContent).toBe(PHOTO_ERRORS.save);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
});
