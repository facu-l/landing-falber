import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Panel en surface-raised con borde fino y esquinas rectas. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-none border border-border bg-surface-raised p-4", className)}
      {...props}
    />
  );
}
