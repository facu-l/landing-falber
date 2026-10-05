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
          "transition-colors duration-150 focus:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-accent-strong" : "border-border-strong",
        )}
        {...props}
      />
      {message && (
        <p id={messageId} className={cn("text-body-sm", error ? "text-text" : "text-text-muted")}>
          {message}
        </p>
      )}
    </div>
  );
}
