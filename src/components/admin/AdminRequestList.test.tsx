import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminRequestListItem } from "@/lib/admin/requests";

// La lista monta el form de estado, que importa la Server Action.
vi.mock("@/app/admin/(panel)/encargos/actions", () => ({ updateRequestStatus: vi.fn() }));

const { AdminRequestList } = await import("./AdminRequestList");

function request(overrides: Partial<AdminRequestListItem>): AdminRequestListItem {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    customer_name: "Ana Pérez",
    perfume_name: "Aventus",
    brand: "Creed",
    presentation: "Decant 10 ml",
    note: "Si llega antes de fin de mes",
    status: "pending",
    created_at: "2026-10-09T15:00:00Z",
    customers: { whatsapp: "+5492215551234" },
    ...overrides,
  };
}

const rows = () => screen.getAllByRole("listitem");

describe("AdminRequestList", () => {
  it("sin encargos lo dice", () => {
    render(<AdminRequestList requests={[]} />);
    expect(screen.getByText("Todavía no hay encargos.")).toBeTruthy();
  });

  it("muestra los pendientes primero", () => {
    render(
      <AdminRequestList
        requests={[
          request({ id: "a", perfume_name: "Contactado", status: "contacted", created_at: "2026-10-09T15:00:00Z" }),
          request({ id: "b", perfume_name: "Pendiente", status: "pending", created_at: "2026-10-01T15:00:00Z" }),
        ]}
      />,
    );
    expect(rows().map((row) => within(row).getByRole("heading").textContent)).toEqual(["Pendiente", "Contactado"]);
  });

  it("muestra el encargo completo: cliente, marca, presentación, nota y estado", () => {
    render(<AdminRequestList requests={[request({})]} />);
    const row = rows()[0];

    for (const text of ["Aventus", "Ana Pérez", "Creed", "Decant 10 ml", "Si llega antes de fin de mes", "Pendiente"]) {
      expect(within(row).getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
    }
  });

  it("omite lo opcional que el cliente no completó", () => {
    render(<AdminRequestList requests={[request({ brand: null, presentation: null, note: null })]} />);
    const row = rows()[0];
    expect(within(row).queryByText(/Nota/)).toBeNull();
    expect(within(row).queryByText("Creed")).toBeNull();
  });

  it("ofrece escribirle al cliente por WhatsApp con un saludo armado, en una pestaña nueva", () => {
    render(<AdminRequestList requests={[request({})]} />);
    const link = within(rows()[0]).getByRole("link", { name: "Escribirle por WhatsApp" });
    const url = new URL(link.getAttribute("href")!);

    expect(url.origin + url.pathname).toBe("https://wa.me/5492215551234");
    expect(url.searchParams.get("text")).toBe("Hola Ana, te escribo de FALBER por tu encargo de Aventus.");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("avisa cuando el historial llegó al tope", () => {
    render(<AdminRequestList requests={[request({ status: "completed" })]} closedTruncated />);
    expect(screen.getByText(/Se muestran los últimos 100 encargos completados o cancelados/)).toBeTruthy();
  });
});
