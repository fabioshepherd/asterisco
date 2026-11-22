import type { Ref } from "react";

import { cn } from "@/lib/utils";

import "./app-mark.css";

/** One drop of the asterisk, pointing up from the centre of the 64-unit box. */
const DROP = "M32 32C28.2 26.5 25.5 19 25.5 14a6.5 6.5 0 0 1 13 0C38.5 19 35.8 26.5 32 32Z";
const ANGLES = [0, 72, 144, 216, 288] as const;

interface AppMarkProps {
  className?: string;
  /**
   * Accessible name. Leave it out where the product name is already written
   * next to the mark: the mark is then decorative and hidden from assistive
   * technology.
   */
  label?: string;
  /** The element the motion helpers (`app-mark-motion.ts`) animate. */
  ref?: Ref<SVGSVGElement>;
}

/**
 * The app mark: the five-drop asterisk (docs/brand/logo-e-animazioni.md). It is
 * drawn in `currentColor`, so it takes the ink of whatever surrounds it and
 * follows the theme; the orange signal stays reserved for state.
 *
 * The tree is the one the motion slice animates: `g.spin` (the whole asterisk)
 * holds five rotated `path.drop` and the `circle.core`; the motion lives in
 * `app-mark-motion.ts`, and the mark is static wherever nobody calls it.
 */
export function AppMark({ className, label, ref }: AppMarkProps) {
  const named = label !== undefined;
  return (
    <svg
      ref={ref}
      viewBox="0 0 64 64"
      className={cn("app-mark", className)}
      fill="currentColor"
      role={named ? "img" : undefined}
      aria-label={named ? label : undefined}
      aria-hidden={named ? undefined : true}
      focusable="false"
    >
      <g className="spin">
        <g transform="translate(32 32) scale(1.15) translate(-32 -32)">
          {ANGLES.map((angle) => (
            <g key={angle} transform={`rotate(${angle} 32 32)`}>
              <path className="drop" d={DROP} />
            </g>
          ))}
          <circle className="core" cx="32" cy="32" r="5.5" />
        </g>
      </g>
    </svg>
  );
}
