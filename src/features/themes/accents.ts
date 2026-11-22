/**
 * Accent palette registry.
 *
 * The accent is one of the user-selectable colour axes: each option maps 1:1 to an
 * official Radix scale (the role mapping lives in `src/styles/accents.css`, keyed
 * by the `data-accent` attribute). The neutral base is itself selectable (default
 * Radix "Gray"); see `neutrals.ts`.
 * `"gray"` is the monochrome option (no chromatic accent — it follows whichever
 * neutral is live). Every accent uses the same measured step mapping (fill and
 * ring on step 11, signal on step 9), so no combination needs a runtime contrast
 * check; `contrast.test.ts` pins the numbers. `resolveAccent` only coerces
 * unknown values to the default.
 */

export const ACCENTS = [
  "orange",
  "jade",
  "grass",
  "teal",
  "blue",
  "indigo",
  "plum",
  "bronze",
  "gold",
  "tomato",
  "gray",
] as const;

export type Accent = (typeof ACCENTS)[number];

/** Default accent when none is persisted (migration fallback) — the signal colour. */
export const DEFAULT_ACCENT: Accent = "orange";

/** localStorage key mirrored for the pre-paint bootstrap (public/theme-init.js). */
export const ACCENT_KEY = "asterisco.accent";

/** Coerce any persisted/imported value to a known accent (default otherwise). */
export function resolveAccent(value: string | null | undefined): Accent {
  return ACCENTS.includes(value as Accent) ? (value as Accent) : DEFAULT_ACCENT;
}
