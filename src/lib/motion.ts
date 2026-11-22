/**
 * Single source of truth for motion. CSS-only animations read the matching CSS
 * variables in src/styles/global.css; motion-component animations read these JS
 * presets. Personality: "snappy & quiet" — fast, low-amplitude, no overshoot.
 *
 * NOTE: `motion` expresses tween durations in SECONDS (not ms); the CSS layer
 * uses the ms equivalents. Keep the two in sync.
 */
export const DURATION = {
  fast: 0.12, // 120ms — micro-interactions, fades
  base: 0.16, // 160ms — most enter/exit
  slow: 0.22, // 220ms — larger surfaces
} as const;

// cubic-bezier control points (also defined in CSS as --motion-ease-*).
export const EASE = {
  out: [0.2, 0, 0, 1], // snappy deceleration
  standard: [0.4, 0, 0.2, 1],
} as const;

export const tween = {
  fast: { duration: DURATION.base, ease: EASE.out },
} as const;

/** Shared fade+rise variant for overlays/panels (scale 0.98→1, 8px rise). */
export const overlayMotion = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 8 },
  transition: tween.fast,
} as const;

/** Shared fade for backdrops/scrims. */
export const fadeMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast, ease: EASE.out },
} as const;

/**
 * The app mark's motion (docs/brand/logo-e-animazioni.md, "Momenti animati").
 * The one documented exception to the 120–220ms bounds (DESIGN.md §5, "The logo
 * exception"): spring-based, only in four state-linked moments, never at cold
 * launch, on the document or on the typing path, instant under reduced motion.
 * Durations in ms (Web Animations API).
 */
export const MARK_MOTION = {
  /** Damped springs, mass 1: stiffness k, damping c. */
  springSoft: { k: 170, c: 18 },
  springPop: { k: 260, c: 16 },
  expo: "cubic-bezier(0.16, 1, 0.3, 1)",
  sine: "cubic-bezier(0.37, 0, 0.63, 1)",
  step: "cubic-bezier(0.45, 0, 0.55, 1)",
  /** Used for the springs where CSS `linear()` is not supported. */
  springFallback: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** A3, the breathing loop: one period, and when it stops by itself (WCAG 2.2.2). */
  breathPeriod: 1600,
  breathLimit: 5000,
} as const;
