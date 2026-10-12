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

  it("si la red se corta en una Server Action, muestra el error y deja reintentar (no queda trabado)", async () => {
    mocks.requestPhotoUpload.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    choose();

    expect((await screen.findByRole("alert")).textContent).toBe(PHOTO_ERRORS.upload);
    expect((screen.getByLabelText(/foto$/i) as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Foto guardada.")).toBeTruthy();
  });

  it("si preparar la foto lanza, lo dice como foto ilegible", async () => {
    mocks.preparePhoto.mockRejectedValueOnce(new Error("canvas"));
    render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    choose();

    expect((await screen.findByRole("alert")).textContent).toBe(PHOTO_ERRORS.unreadable);
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

  // Generated by /ship test coverage audit.
  // Value: protects=while a photo uploads, the picker is disabled and the local preview shows, so a second pick can't start a parallel upload;
  // fails_when=disabled={busy} is removed (two uploads race; the loser's photo is deleted and it shows a save error) or the preview is not freed;
  // why_new=existing tests only assert the input is enabled after an error, never during the upload; seam=none;
  // no_claim=server-side compare-and-set between tabs (covered in actions.test.ts)
  it("mientras sube, no deja elegir otra foto y muestra la vista previa local; al terminar la libera", async () => {
    let finishUpload!: (ok: boolean) => void;
    mocks.uploadToSignedUrl.mockReturnValueOnce(new Promise<boolean>((resolve) => (finishUpload = resolve)));
    const { container } = render(<ProductPhotoField productId="p" imagePath="vieja.webp" alt="Dior · Sauvage" />);
    choose();

    expect(await screen.findByText("Subiendo foto")).toBeTruthy();
    const input = screen.getByLabelText(/foto$/i) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container.querySelector('img[src="blob:local"]')).not.toBeNull();

    finishUpload(true);
    expect(await screen.findByText("Foto guardada.")).toBeTruthy();
    expect(input.disabled).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local");
    expect(mocks.requestPhotoUpload).toHaveBeenCalledTimes(1);
  });

  // Value: protects=the progress line is one live region that exists before the first step, so screen readers announce "Subiendo foto";
  // fails_when=the idle message loses role="status" (the region appears together with its first text and is often not announced);
  // why_new=other tests find the text, not the region it lives in; seam=none; no_claim=what each screen reader actually speaks
  it("el estado de la foto es una sola región viva desde el principio: los pasos cambian su texto", async () => {
    render(<ProductPhotoField productId="p" imagePath={null} alt="Dior · Sauvage" />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("Sin foto.");

    choose();

    expect(await screen.findByText("Foto guardada.")).toBe(region);
  });
});
