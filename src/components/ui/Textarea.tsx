import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type TextareaProps = ComponentProps<"textarea"> & {
  label: string;
  hint?: string;
  /** Mensaje de error. Si está presente, marca el campo como inválido. */
  error?: string;
};

/**
 * Mismo contrato que Input: label en mayúsculas arriba, campo, y hint o error abajo
 * conectados con aria-describedby. Crece solo en vertical para no romper la columna.
 */
export function Textarea({ label, hint, error, id, className, rows = 4, ...props }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-message`;
  // || y no ??: un error vacío ("") no debe esconder el hint.
  const message = error || hint;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={textareaId} className="text-label text-text-secondary uppercase">
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "resize-y rounded-none border bg-surface px-3 py-3 text-body text-text",
          "placeholder:text-text-muted",
          "transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Con error, el borde sigue en error aun con foco: el anillo de foco ya indica dónde estás.
          error ? "border-error" : "border-border-strong focus:border-accent",
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
