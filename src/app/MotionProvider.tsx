import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Root motion context. `LazyMotion` + the `m` component (used everywhere instead
 * of `motion.*`) keeps the initial bundle small — `domAnimation` features are
 * lazy-loaded. `reducedMotion="user"` makes every motion component honor the OS
 * prefers-reduced-motion setting, stacking with the CSS reset in global.css.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
