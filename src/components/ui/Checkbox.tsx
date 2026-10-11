import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  label: string;
  hint?: string;
  /** Mensaje de error. Si está presente, marca el campo como inválido. */
  error?: string;
};

/**
 * Contrato de Input (label obligatorio, hint o error abajo con aria-describedby),
 * pero con el label al costado de la casilla, como es convención en un checkbox.
 * Todo el renglón es el <label>: el área táctil llega a 44 px aunque la casilla sea chica.
 */
export function Checkbox({ label, hint, error, id, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const messageId = `${checkboxId}-message`;
  // || y no ??: un error vacío ("") no debe esconder el hint.
  const message = error || hint;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={checkboxId}
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-3",
          props.disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          type="checkbox"
          id={checkboxId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            // Casilla nativa: accesible con teclado y lector de pantalla sin JavaScript.
            // accent-color la pinta con el token; el foco usa el anillo global de :focus-visible.
            // Sin outline de error: una utilidad pisaría ese anillo. El error se lee en el mensaje.
            "size-5 shrink-0 cursor-[inherit] rounded-none accent-accent",
          )}
          {...props}
        />
        <span className="text-label text-text-secondary uppercase">{label}</span>
      </label>
      {message && (
        <p id={messageId} className={cn("text-body-sm", error ? "text-error" : "text-text-muted")}>
          {message}
        </p>
      )}
    </div>
  );
}
