import type { ReactNode } from "react";

/** Bloque de un formulario (tienda y admin): título en label (MAYÚSCULAS) y los campos debajo. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-label text-text-secondary uppercase">{title}</h2>
      {children}
    </section>
  );
}
