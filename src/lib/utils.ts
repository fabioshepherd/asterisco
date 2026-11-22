import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * `text-data` is a custom `@utility` (global.css) that tailwind-merge does not
 * know; unconfigured it reads as a text colour and a later `text-fg` drops it.
 * Registering it in the font-size group lets it coexist with colour utilities
 * and still conflict with `text-xs`/`text-sm`, which set the same property.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ["text-data"],
    },
  },
});

/** Merge conditional class names and de-duplicate conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
