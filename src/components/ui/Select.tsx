import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type SelectProps = ComponentProps<"select"> & {
  label: string;
};

/**
 * Mismo contrato visual que Input: label en mayúsculas arriba, esquinas rectas.
 * Es un <select> nativo: accesible y cómodo en el celular sin JavaScript.
 */
export function Select({ label, id, className, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={selectId} className="text-label text-text-secondary uppercase">
        {label}
      </label>
      <select
        id={selectId}
        className={cn(
          // h-13 (52px) = misma altura que Input: un <select> nativo ignora el line-height.
          "h-13 rounded-none border border-border-strong bg-surface px-3 text-body text-text",
          "transition-colors duration-150 focus:border-accent",
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
