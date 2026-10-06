import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type SelectProps = ComponentProps<"select"> & {
  label: string;
  /** Mensaje de error. Si está presente, marca el campo como inválido. */
  error?: string;
};

/**
 * Mismo contrato visual que Input: label en mayúsculas arriba, esquinas rectas,
 * error abajo conectado con aria-describedby.
 * Es un <select> nativo: accesible y cómodo en el celular sin JavaScript.
 */
export function Select({ label, error, id, className, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = `${selectId}-message`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={selectId} className="text-label text-text-secondary uppercase">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
        className={cn(
          // h-13 (52px) = misma altura que Input: un <select> nativo ignora el line-height.
          "h-13 rounded-none border bg-surface px-3 text-body text-text",
          "transition-colors duration-150",
          error ? "border-error" : "border-border-strong focus:border-accent",
        )}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={messageId} className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
