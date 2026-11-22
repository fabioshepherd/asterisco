/**
 * Neutral base palette registry.
 *
 * The neutral is the base/paper colour axis — a third independent axis alongside
 * light/dark (`data-theme`) and accent (`data-accent`). Each option maps 1:1 to
 * an official Radix gray scale (the role mapping lives in `src/styles/neutrals.css`,
 * keyed by the `data-neutral` attribute). Default is Radix "Gray", a true neutral
 * at chroma 0: temperature is the user's choice, not a default (Sand is warm,
 * Slate is cool). Contrast is guaranteed by the Radix scales in both light and
 * dark, so there is no runtime validation beyond `resolveNeutral` coercing unknown
 * values to the default.
 */

export const NEUTRALS = ["gray", "sand", "slate"] as const;

export type Neutral = (typeof NEUTRALS)[number];

/** Default neutral when none is persisted (migration fallback) — chroma 0. */
export const DEFAULT_NEUTRAL: Neutral = "gray";

/** localStorage key mirrored for the pre-paint bootstrap (public/theme-init.js). */
export const NEUTRAL_KEY = "asterisco.neutral";

/** Coerce any persisted/imported value to a known neutral (default otherwise). */
export function resolveNeutral(value: string | null | undefined): Neutral {
  return NEUTRALS.includes(value as Neutral) ? (value as Neutral) : DEFAULT_NEUTRAL;
}
