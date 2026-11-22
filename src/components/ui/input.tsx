import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared text/number input wired to the semantic design tokens. One control
 * vocabulary across the app: hairline border, paper background, `8px 10px`
 * padding, the shared focus-visible ring. Pair with the Select primitive so
 * inputs and selects read as the same family (the settings panel previously
 * mixed `bg-muted` borderless inputs with bordered selects).
 */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-8 rounded-md border border-border bg-bg px-2.5 text-sm text-fg",
          "placeholder:text-muted-fg",
          "transition-[color,background-color,border-color] duration-(--motion-duration-fast) ease-snappy",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export { Input };
