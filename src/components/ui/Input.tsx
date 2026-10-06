import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  /** Mensaje de error. Si está presente, marca el campo como inválido. */
  error?: string;
};

/**
 * Label en mayúsculas arriba, campo, y hint o error abajo.
 * El label es obligatorio: un input sin label no es accesible.
 * El hint y el error se conectan con aria-describedby para los lectores de pantalla.
 */
export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  // || y no ??: un error vacío ("") no debe esconder el hint.
  const message = error || hint;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-label text-text-secondary uppercase">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "rounded-none border bg-surface px-3 py-3 text-body text-text",
          "placeholder:text-text-muted",
          "transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Solo lectura (ej. un perfume precargado): se lee como dato, no como campo para escribir.
          // Por la prop y no con read-only: porque :read-only también matchea un input deshabilitado.
          props.readOnly && "cursor-default bg-surface-raised text-text-secondary",
          // Con error, el borde sigue en error aun con foco: el anillo de foco ya indica dónde estás.
          error ? "border-error" : props.readOnly ? "border-border" : "border-border-strong focus:border-accent",
        )}
        {...props}
      />
      {message && (
        <p id={messageId} className={cn("text-body-sm", error ? "text-error" : "text-text-muted")}>
          {message}
        </p>
      )}
    </div>
  );
}
