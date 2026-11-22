import { MARK_MOTION } from "@/lib/motion";

/*
 * The four moments of the app mark (docs/brand/logo-e-animazioni.md, "Momenti
 * animati"), on the Web Animations API. Only `transform` and `opacity` move; the
 * parts pivot on the centre of the view box (app-mark.css). Under
 * `prefers-reduced-motion: reduce` nothing runs: the mark is simply there.
 */

type Spring = { k: number; c: number };

const SAMPLES = 49;

/**
 * A damped spring (mass 1) from 0 to 1, sampled into `SAMPLES` points over the
 * time it takes to settle within 1/1000: T = ln(1000) / (ζ·ω0).
 */
export function springSamples({ k, c }: Spring): number[] {
  const w0 = Math.sqrt(k);
  const zeta = c / (2 * Math.sqrt(k));
  const settle = Math.log(1000) / (zeta * w0);
  const points: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = (settle * i) / (SAMPLES - 1);
    let x: number;
    if (zeta < 1) {
      // Underdamped: overshoots and rings down (both springs in use).
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      x = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    } else if (zeta > 1) {
      const wd = w0 * Math.sqrt(zeta * zeta - 1);
      x =
        1 - Math.exp(-zeta * w0 * t) * (Math.cosh(wd * t) + ((zeta * w0) / wd) * Math.sinh(wd * t));
    } else {
      x = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    }
    points.push(i === 0 ? 0 : i === SAMPLES - 1 ? 1 : x);
  }
  return points;
}

/** Whether this engine understands CSS `linear()` easing (not macOS 10.15's WebKit). */
export function supportsLinearEasing(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("transition-timing-function", "linear(0, 1)")
  );
}

/** A spring as an easing string: `linear()` where supported, else the fallback curve. */
export function springEasing(spring: Spring): string {
  if (!supportsLinearEasing()) return MARK_MOTION.springFallback;
  return `linear(${springSamples(spring)
    .map((x) => Number(x.toFixed(4)))
    .join(", ")})`;
}

/**
 * Where the spin settles after the breathing loop: the next multiple of 72°
 * past the current angle (with 8° of slack, so it never snaps back). The mark
 * has fivefold symmetry, so any multiple of 72° looks exactly like 0°.
 */
export function nextRestAngle(angle: number): number {
  return Math.ceil((angle + 8) / 72) * 72;
}

/** The rotation in a computed `transform` (a `matrix(...)` or `none`), in 0–360°. */
export function angleOf(transform: string): number {
  const match = /^matrix\(([^)]+)\)$/.exec(transform.trim());
  if (!match?.[1]) return 0;
  const [a = 1, b = 0] = match[1].split(",").map(Number);
  const degrees = (Math.atan2(b, a) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Parts {
  svg: SVGSVGElement;
  spin: SVGGElement;
  drops: SVGPathElement[];
  core: SVGCircleElement;
}

function partsOf(svg: SVGSVGElement | null): Parts | null {
  if (!svg || reducedMotion() || typeof svg.animate !== "function") return null;
  const spin = svg.querySelector<SVGGElement>(".spin");
  const core = svg.querySelector<SVGCircleElement>(".core");
  const drops = [...svg.querySelectorAll<SVGPathElement>(".drop")];
  if (!spin || !core || drops.length === 0) return null;
  return { svg, spin, drops, core };
}

/** Every animation on the mark and its parts (no-op where the API is missing). */
function markAnimations(svg: SVGSVGElement): Animation[] {
  return typeof svg.getAnimations === "function" ? svg.getAnimations({ subtree: true }) : [];
}

function finishAll(svg: SVGSVGElement): void {
  markAnimations(svg).forEach((animation) => animation.finish());
}

function cancelAll(svg: SVGSVGElement): void {
  markAnimations(svg).forEach((animation) => animation.cancel());
}

const soft = () => springEasing(MARK_MOTION.springSoft);
const pop = () => springEasing(MARK_MOTION.springPop);

/** A1: the empty state comes back after the last document closes. */
export function playEmptyStateReturn(svg: SVGSVGElement | null): void {
  const parts = partsOf(svg);
  if (!parts) return;
  parts.svg.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 220,
    easing: "ease-out",
    fill: "backwards",
  });
  parts.spin.animate([{ transform: "rotate(-40deg) scale(0.55)" }, { transform: "none" }], {
    duration: 620,
    easing: soft(),
    fill: "backwards",
  });
  parts.drops.forEach((drop, i) => {
    drop.animate([{ transform: "scale(0.85, 0.6)" }, { transform: "none" }], {
      duration: 560,
      delay: 30 * i,
      easing: soft(),
      fill: "backwards",
    });
  });
}

/** A2: the About panel opens. */
export function playAboutOpen(svg: SVGSVGElement | null): void {
  const parts = partsOf(svg);
  if (!parts) return;
  parts.spin.animate([{ transform: "rotate(-90deg)" }, { transform: "rotate(0deg)" }], {
    duration: 900,
    easing: MARK_MOTION.expo,
    fill: "backwards",
  });
  parts.core.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
    duration: 450,
    easing: pop(),
    fill: "backwards",
  });
  parts.drops.forEach((drop, i) => {
    drop.animate([{ transform: "scale(0.3, 0)" }, { transform: "none" }], {
      duration: 620,
      delay: 80 + 55 * i,
      easing: soft(),
      fill: "backwards",
    });
  });
}

export interface Breathing {
  /** A4: settle softly from wherever the loop is (the check has an answer). */
  settle: () => void;
  /** Stop at once, without settling (the panel is closing). */
  cancel: () => void;
}

const IDLE: Breathing = { settle: () => undefined, cancel: () => undefined };

/**
 * A3: the mark breathes while an update check runs — a wave through the drops,
 * the core pulsing at twice the rate, a fifth of a turn per period. It stops by
 * itself after `breathLimit` (WCAG 2.2.2), settling as A4 does, and at once if
 * the user turns on reduced motion meanwhile.
 *
 * The turn is one full revolution over five periods, eased per 72° step, rather
 * than 0→72° repeated: the fivefold symmetry hides a reset of the turn but not of
 * the wave, which would jump by a fifth of a period at every restart.
 */
export function startBreathing(svg: SVGSVGElement | null): Breathing {
  const parts = partsOf(svg);
  if (!parts) return IDLE;
  // Whatever is still playing (A2 on a quick click) ends now, not under the loop.
  finishAll(parts.svg);
  const period = MARK_MOTION.breathPeriod;
  const { sine } = MARK_MOTION;

  const loops: Animation[] = [
    ...parts.drops.map((drop, i) =>
      drop.animate(
        [
          { transform: "rotate(0deg) scale(1, 1)", easing: sine },
          { transform: "rotate(6deg) scale(0.9, 0.68)", easing: sine },
          { transform: "rotate(0deg) scale(1, 1)" },
        ],
        { duration: period, delay: (-i * period) / 5, iterations: Infinity },
      ),
    ),
    parts.core.animate(
      [
        { transform: "scale(1)", easing: sine },
        { transform: "scale(0.8)", easing: sine },
        { transform: "scale(1)" },
      ],
      { duration: period / 2, iterations: Infinity },
    ),
    parts.spin.animate(
      [0, 72, 144, 216, 288, 360].map((deg, i) => ({
        transform: `rotate(${deg}deg)`,
        ...(i < 5 ? { easing: MARK_MOTION.step } : {}),
      })),
      { duration: period * 5, iterations: Infinity },
    ),
  ];

  let state: "running" | "settled" | "done" = "running";

  const settleFromLoop = () => {
    const drops = parts.drops.map((drop) => getComputedStyle(drop).transform);
    const core = getComputedStyle(parts.core).transform;
    const angle = angleOf(getComputedStyle(parts.spin).transform);
    loops.forEach((animation) => animation.cancel());

    parts.drops.forEach((drop, i) => {
      drop.animate([{ transform: drops[i] ?? "none" }, { transform: "none" }], {
        duration: 640,
        delay: 25 * i,
        easing: soft(),
        fill: "backwards",
      });
    });
    parts.core.animate([{ transform: core }, { transform: "scale(1)" }], {
      duration: 520,
      easing: pop(),
    });
    parts.spin.animate(
      [{ transform: `rotate(${angle}deg)` }, { transform: `rotate(${nextRestAngle(angle)}deg)` }],
      { duration: 640, easing: soft() },
    );
  };

  const limit = window.setTimeout(() => {
    if (state !== "running") return;
    state = "settled";
    settleFromLoop();
  }, MARK_MOTION.breathLimit);

  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stop = () => {
    window.clearTimeout(limit);
    query.removeEventListener("change", onReduce);
    state = "done";
    loops.forEach((animation) => animation.cancel());
    cancelAll(parts.svg);
  };
  const onReduce = (event: MediaQueryListEvent) => {
    if (event.matches) stop();
  };
  query.addEventListener("change", onReduce);

  return {
    settle: () => {
      window.clearTimeout(limit);
      query.removeEventListener("change", onReduce);
      if (state === "done") return;
      if (state === "settled") {
        // The loop already stopped at its limit: a small nod for the answer.
        parts.spin.animate([{ transform: "scale(0.9)" }, { transform: "scale(1)" }], {
          duration: 560,
          easing: pop(),
        });
        state = "done";
        return;
      }
      state = "done";
      settleFromLoop();
    },
    // Also stops an A4 already under way: the panel is going.
    cancel: stop,
  };
}
