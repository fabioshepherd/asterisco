import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// shadcn/ui-style button wired to the project's semantic design tokens
// (see src/styles/global.css).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,transform] duration-(--motion-duration-fast) ease-snappy active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid fills are the accent's step 11 with the opposite neutral extreme on
        // top, and they darken toward --fg on hover — never fade toward --bg, which
        // would drop the measured contrast below AA (DESIGN.md §2).
        default: "bg-primary text-primary-fg hover:bg-primary-hover",
        outline: "border border-border bg-bg hover:bg-muted hover:text-fg",
        ghost: "hover:bg-muted hover:text-fg",
        danger: "bg-danger-solid text-on-solid hover:bg-danger-hover",
        "destructive-outline": "border border-danger bg-bg text-danger-text hover:bg-danger/10",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
        "icon-sm": "size-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
});

export { Button, buttonVariants };
