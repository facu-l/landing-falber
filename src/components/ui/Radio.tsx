import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Grupo de opciones excluyentes como filas con divisor: la elegida se marca con el borde
 * izquierdo en accent. El radio nativo queda oculto (sr-only) pero es el que recibe el foco
 * y el teclado; el anillo de foco se dibuja en la fila (has-focus-visible).
 * El legend es solo para lectores de pantalla: el título visible lo pone la sección.
 */
export function RadioGroup({ legend, error, children }: { legend: string; error?: string; children: ReactNode }) {
  return (
    <fieldset aria-invalid={error ? true : undefined} className="flex flex-col border-t border-border">
      <legend className="sr-only">{legend}</legend>
      {children}
      {error && <p className="pt-3 text-body-sm text-error">{error}</p>}
    </fieldset>
  );
}

type RadioOptionProps = {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail: ReactNode;
  disabled?: boolean;
};

export function RadioOption({ name, value, checked, onChange, label, detail, disabled = false }: RadioOptionProps) {
  return (
    <label
      className={cn(
        "flex flex-col gap-1 border-b border-border border-l-2 border-l-transparent py-4 pr-2 pl-4",
        "transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-accent",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:bg-surface-raised has-checked:border-l-accent has-checked:bg-surface-raised",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span className="text-body text-text">{label}</span>
      <span className="text-body-sm text-text-secondary">{detail}</span>
    </label>
  );
}
