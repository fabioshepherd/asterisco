import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MARK_MOTION } from "@/lib/motion";
import { mockReducedMotion } from "@/test/motion";

import {
  angleOf,
  nextRestAngle,
  playAboutOpen,
  playEmptyStateReturn,
  springEasing,
  springSamples,
  startBreathing,
} from "./app-mark-motion";

/** A mark with the AppMark tree (spin > 5 drops + core). */
function markElement(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const spin = document.createElementNS(ns, "g");
  spin.setAttribute("class", "spin");
  for (let i = 0; i < 5; i++) {
    const drop = document.createElementNS(ns, "path");
    drop.setAttribute("class", "drop");
    spin.append(drop);
  }
  const core = document.createElementNS(ns, "circle");
  core.setAttribute("class", "core");
  spin.append(core);
  svg.append(spin);
  return svg;
}

interface FakeAnimation {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  cancel: ReturnType<typeof vi.fn>;
  finish: ReturnType<typeof vi.fn>;
}

let animations: FakeAnimation[] = [];

beforeEach(() => {
  mockReducedMotion(false);
  animations = [];
  // jsdom has no Web Animations API: record what would run.
  Element.prototype.animate = vi.fn(function (
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    options?: number | KeyframeAnimationOptions,
  ) {
    const animation: FakeAnimation = {
      target: this,
      keyframes: Array.isArray(keyframes) ? keyframes : [],
      options: typeof options === "number" ? { duration: options } : (options ?? {}),
      cancel: vi.fn(),
      finish: vi.fn(),
    };
    animations.push(animation);
    return animation as unknown as Animation;
  });
  Element.prototype.getAnimations = vi.fn(() => animations as unknown as Animation[]);
  vi.stubGlobal("CSS", { supports: () => true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("springSamples", () => {
  it.each([MARK_MOTION.springSoft, MARK_MOTION.springPop])(
    "goes from 0 to 1 in 49 points (k=$k, c=$c)",
    (spring) => {
      const points = springSamples(spring);
      expect(points).toHaveLength(49);
      expect(points[0]).toBe(0);
      expect(points[48]).toBe(1);
    },
  );

  it("overshoots: these springs are underdamped", () => {
    expect(Math.max(...springSamples(MARK_MOTION.springPop))).toBeGreaterThan(1);
  });
});

describe("springEasing", () => {
  it("is a linear() curve where the engine supports it", () => {
    expect(springEasing(MARK_MOTION.springSoft)).toMatch(/^linear\(0, .*, 1\)$/);
  });

  it("falls back to a cubic-bezier without linear() (macOS 10.15)", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    expect(springEasing(MARK_MOTION.springSoft)).toBe(MARK_MOTION.springFallback);
  });
});

describe("nextRestAngle", () => {
  it("is always a multiple of 72° past the current angle", () => {
    for (let angle = 0; angle < 360; angle += 7.5) {
      const rest = nextRestAngle(angle);
      expect(rest % 72).toBe(0);
      expect(rest).toBeGreaterThan(angle);
    }
  });

  it("keeps 8° of slack, so a spin just short of a rest goes on to the next", () => {
    expect(nextRestAngle(0)).toBe(72);
    expect(nextRestAngle(63)).toBe(72);
    expect(nextRestAngle(65)).toBe(144);
    expect(nextRestAngle(352)).toBe(360);
  });
});

describe("angleOf", () => {
  it("reads the rotation out of a computed matrix, in 0–360°", () => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const matrix = (deg: number) =>
      `matrix(${Math.cos(rad(deg))}, ${Math.sin(rad(deg))}, ${-Math.sin(rad(deg))}, ${Math.cos(rad(deg))}, 0, 0)`;
    expect(angleOf(matrix(30))).toBeCloseTo(30);
    expect(angleOf(matrix(-30))).toBeCloseTo(330);
    expect(angleOf("none")).toBe(0);
  });
});

describe("the moments", () => {
  it("do nothing under reduced motion", () => {
    mockReducedMotion(true);
    const svg = markElement();
    playEmptyStateReturn(svg);
    playAboutOpen(svg);
    startBreathing(svg).settle();
    expect(animations).toHaveLength(0);
  });

  it("A2 animates the spin, the core and every drop", () => {
    playAboutOpen(markElement());
    expect(animations).toHaveLength(7);
    expect(animations.filter((a) => a.target.classList.contains("drop"))).toHaveLength(5);
  });

  it("A3 turns once over five periods in 72° steps, so the wave never resets", () => {
    startBreathing(markElement());
    const spin = animations.find((a) => a.target.classList.contains("spin"));
    expect(spin?.options.duration).toBe(MARK_MOTION.breathPeriod * 5);
    expect(spin?.keyframes.map((k) => k.transform)).toEqual(
      [0, 72, 144, 216, 288, 360].map((deg) => `rotate(${deg}deg)`),
    );
  });

  it("A3 first finishes whatever A2 is still playing", () => {
    const svg = markElement();
    playAboutOpen(svg);
    const opening = [...animations];
    startBreathing(svg);
    expect(opening.every((a) => a.finish.mock.calls.length === 1)).toBe(true);
  });

  it("A3 stops at once if the user turns on reduced motion meanwhile", () => {
    let onChange: ((event: { matches: boolean }) => void) | undefined;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => {
        onChange = listener;
      },
      removeEventListener: vi.fn(),
    }));
    startBreathing(markElement());
    const loops = [...animations];
    onChange?.({ matches: true });
    expect(loops.every((a) => a.cancel.mock.calls.length >= 1)).toBe(true);
  });

  it("A3 loops forever until it settles, then leaves no loop running", () => {
    const breathing = startBreathing(markElement());
    const loops = [...animations];
    expect(loops).toHaveLength(7);
    expect(loops.every((a) => a.options.iterations === Infinity)).toBe(true);

    breathing.settle();
    expect(loops.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);
    const settling = animations.slice(loops.length);
    expect(settling).toHaveLength(7);
    expect(settling.some((a) => a.options.iterations === Infinity)).toBe(false);
  });

  it("A3 stops by itself after 5 s (WCAG 2.2.2), and the answer only nods", () => {
    vi.useFakeTimers();
    const breathing = startBreathing(markElement());
    const loops = [...animations];
    vi.advanceTimersByTime(MARK_MOTION.breathLimit);
    expect(loops.every((a) => a.cancel.mock.calls.length === 1)).toBe(true);

    const before = animations.length;
    breathing.settle();
    expect(animations.length - before).toBe(1);
    expect(animations.at(-1)?.target.classList.contains("spin")).toBe(true);
  });

  it("cancel stops the loop at once, without settling", () => {
    const breathing = startBreathing(markElement());
    const loops = [...animations];
    breathing.cancel();
    expect(loops.every((a) => a.cancel.mock.calls.length >= 1)).toBe(true);
    expect(animations).toHaveLength(loops.length);
  });

  it("cancel also stops an A4 already under way (the panel is closing)", () => {
    const breathing = startBreathing(markElement());
    breathing.settle();
    const settling = [...animations];
    breathing.cancel();
    expect(settling.every((a) => a.cancel.mock.calls.length >= 1)).toBe(true);
  });
});
