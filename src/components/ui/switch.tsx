import * as React from "react";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** id of a visible label naming the control (settings rows use this). */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible toggle switch (`role="switch"`). Built on a native button — no new
 * dependency — so it inherits the shared focus-visible ring and reads state to
 * assistive tech via `aria-checked`. Quietly tactile: a track that fills with
 * the accent when on, a knob that slides; the global reduced-motion rule
 * collapses the slide. Replaces the bare native checkboxes in settings so
 * booleans read their on/off state at a glance.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, disabled, className, ...aria },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border",
        "transition-colors duration-(--motion-duration-fast) ease-snappy",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-primary bg-primary" : "bg-muted",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block size-3.5 rounded-full bg-bg shadow-sm",
          "transition-transform duration-(--motion-duration-fast) ease-snappy",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
});

export { Switch };
