import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared native `<select>` styled to match the Input primitive (same border,
 * background, height, radius and focus ring) so the two read as one control
 * family. The native chevron and OS dropdown are kept on purpose — earned
 * familiarity beats a reinvented popover for a standard task.
 */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-8 rounded-md border border-border bg-bg px-2.5 text-sm text-fg",
          "transition-[color,background-color,border-color] duration-(--motion-duration-fast) ease-snappy",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export { Select };
