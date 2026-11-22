import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A single mutually-exclusive choice: segmented controls and option lists.
 *
 * One selected style everywhere (DESIGN.md §2, Signal Rule): a muted chip with
 * the ink stepping from `--muted-fg` to `--fg`, plus a 1px `--muted-fg`
 * (step 11) hairline, which is the non-colour cue: 4.5:1+ against the surface
 * and page in every neutral and mode (contrast.test.ts, SC 1.4.1 / 1.4.11), where
 * the chip alone is 1.1:1. Never a solid accent fill — a resting settings panel
 * would otherwise show one per row. Every option reserves the border (transparent
 * when unselected) so selecting does not shift the row.
 *
 * A real `role="radiogroup"` (APG Radio Group): one tab stop on the checked
 * option, and the arrow keys move selection and focus together, so screen
 * readers announce "n of m" rather than a row of independent toggles.
 */
function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  renderOption,
  itemClassName,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange" | "role"> & {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  renderOption: (option: T, checked: boolean) => React.ReactNode;
  /** Size and spacing of each option; the selected treatment is fixed. */
  itemClassName?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const nextIndex = (index + step + options.length) % options.length;
    const next = options[nextIndex];
    if (next === undefined) return;
    onChange(next);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" className={className} {...props}>
      {options.map((option, index) => {
        const checked = option === value;
        return (
          <button
            key={option}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 py-1 text-muted-fg",
              "transition-[color,background-color,border-color,transform] duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              "[&_svg]:shrink-0",
              // Weight stays put: a 400→500 swap on select would reflow the row.
              checked && "border-muted-fg bg-muted text-fg",
              itemClassName,
            )}
          >
            {renderOption(option, checked)}
          </button>
        );
      })}
    </div>
  );
}

export { RadioGroup };
